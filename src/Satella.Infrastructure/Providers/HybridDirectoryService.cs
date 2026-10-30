using System.Diagnostics;
using System.DirectoryServices;
using System.Text.Json;
using Satella.Core.Interfaces;
using Satella.Core.Models;
using Satella.Core.Services;
using Satella.Infrastructure.Storage;

namespace Satella.Infrastructure.Providers;

public class HybridDirectoryService : IDirectoryService
{
    private readonly LocalDatabase _db;
    private readonly object _sync = new();

    private List<DomainProfile> _profiles = new();
    private SandboxStateDocument _sandboxState = new();
    private SandboxStateDocument? _liveState;
    private SandboxStateDocument _state => GetActiveProfile().IsSandbox ? _sandboxState : (_liveState ?? _sandboxState);
    private List<OnboardingTemplate> _templates = new();
    private List<AuditActionEntry> _auditLogs = new();

    private const string KeyProfiles = "domain_profiles";
    private const string KeySandbox = "sandbox_state_v1";
    private const string KeyLiveCache = "live_ad_cache_v1";
    private const string KeyTemplates = "onboarding_templates_v1";
    private const string KeyAudit = "audit_logs_v1";

    public HybridDirectoryService(LocalDatabase db)
    {
        _db = db;
        LoadAll();
    }

    private void LoadAll()
    {
        lock (_sync)
        {
            _profiles = _db.Load<List<DomainProfile>>(KeyProfiles) ?? new List<DomainProfile>
            {
                new()
                {
                    Id = "prof-sandbox",
                    Name = "Satella Sandbox AD (Эмулятор)",
                    DomainName = "corp.satella.local",
                    DcHost = "srv-dc-01.corp.satella.local",
                    Port = 389,
                    UseSsl = false,
                    UseCurrentUserSso = true,
                    Username = "CORP\\a.volkov",
                    IsSandbox = true,
                    IsActive = true
                },
                new()
                {
                    Id = "prof-prod-example",
                    Name = "Production Active Directory (LDAP)",
                    DomainName = Environment.UserDomainName + ".local",
                    DcHost = "127.0.0.1",
                    Port = 636,
                    UseSsl = true,
                    UseCurrentUserSso = true,
                    Username = $"{Environment.UserDomainName}\\{Environment.UserName}",
                    IsSandbox = false,
                    IsActive = false
                }
            };

            _sandboxState = _db.Load<SandboxStateDocument>(KeySandbox) ?? SandboxSeeder.CreateInitialState();
            SandboxSeeder.EnsureEnterpriseModulesSeeded(_sandboxState);
            _liveState = _db.Load<SandboxStateDocument>(KeyLiveCache);
            if (_liveState != null)
                SandboxSeeder.EnsureEnterpriseModulesSeeded(_liveState);
            _templates = _db.Load<List<OnboardingTemplate>>(KeyTemplates) ?? SandboxSeeder.CreateDefaultTemplates();
            _auditLogs = _db.Load<List<AuditActionEntry>>(KeyAudit) ?? CreateInitialAuditLogs();

            PersistAll();
        }
    }

    private List<AuditActionEntry> CreateInitialAuditLogs() => new()
    {
        new()
        {
            Id = "aud-init-1",
            Timestamp = DateTime.UtcNow.AddMinutes(-42),
            Actor = "CORP\\a.volkov",
            ProfileName = "Satella Sandbox AD",
            ActionType = "UnlockAccount",
            TargetDn = $"CN=Смирнов Кирилл,OU=Engineering,OU=HQ Moscow,{SandboxSeeder.RootDn}",
            TargetName = "Смирнов Кирилл (k.smirnov)",
            TargetClass = "user",
            Summary = "Разблокировка учётной записи после превышения лимита неверных паролей",
            PowerShellScript = PowerShellGenerator.ForUnlockUser("k.smirnov"),
            CanRollback = false
        },
        new()
        {
            Id = "aud-init-2",
            Timestamp = DateTime.UtcNow.AddHours(-3),
            Actor = "CORP\\i.petrov",
            ProfileName = "Satella Sandbox AD",
            ActionType = "GpoLink",
            TargetDn = $"OU=Finance PCs,OU=Workstations,{SandboxSeeder.RootDn}",
            TargetName = "Finance-Restrict-Removable-USB",
            TargetClass = "gpo",
            Summary = "Включён режим Enforced для политики блокировки USB-накопителей на OU=Finance PCs",
            PowerShellScript = "Set-GPLink -Name \"Finance-Restrict-Removable-USB\" -Target \"OU=Finance PCs,OU=Workstations,DC=corp,DC=satella,DC=local\" -Enforced Yes",
            CanRollback = false
        }
    };

    private void PersistAll()
    {
        _db.Save(KeyProfiles, _profiles);
        _db.Save(KeySandbox, _sandboxState);
        if (_liveState != null)
            _db.Save(KeyLiveCache, _liveState);
        _db.Save(KeyTemplates, _templates);
        _db.Save(KeyAudit, _auditLogs);
    }

    private AuditActionEntry RecordAudit(string actionType, string targetDn, string targetName, string targetClass, string summary, string psScript, object? rollbackSnapshot = null)
    {
        var active = GetActiveProfile();
        var entry = new AuditActionEntry
        {
            Id = "aud-" + Guid.NewGuid().ToString("N")[..8],
            Timestamp = DateTime.UtcNow,
            Actor = string.IsNullOrWhiteSpace(active.Username) ? $"{Environment.UserDomainName}\\{Environment.UserName}" : active.Username,
            ProfileName = active.Name,
            ActionType = actionType,
            TargetDn = targetDn,
            TargetName = targetName,
            TargetClass = targetClass,
            Summary = summary,
            PowerShellScript = psScript,
            CanRollback = rollbackSnapshot != null,
            RollbackPayloadJson = rollbackSnapshot != null ? JsonSerializer.Serialize(rollbackSnapshot) : string.Empty
        };
        _auditLogs.Insert(0, entry);
        if (_auditLogs.Count > 250)
            _auditLogs.RemoveAt(_auditLogs.Count - 1);
        _db.Save(KeyAudit, _auditLogs);
        return entry;
    }

    // ---------------------------------------------------------
    // PROFILES
    // ---------------------------------------------------------
    public List<DomainProfile> GetProfiles()
    {
        lock (_sync)
        {
            return _profiles.ToList();
        }
    }

    public DomainProfile GetActiveProfile()
    {
        lock (_sync)
        {
            return _profiles.FirstOrDefault(p => p.IsActive) ?? _profiles.First();
        }
    }

    public CommandResult<DomainProfile> SwitchProfile(string profileId)
    {
        lock (_sync)
        {
            var target = _profiles.FirstOrDefault(p => p.Id == profileId);
            if (target == null)
                return CommandResult<DomainProfile>.Fail("Профиль не найден");

            foreach (var p in _profiles)
                p.IsActive = p.Id == profileId;

            target.LastConnectedAt = DateTime.UtcNow;

            if (!target.IsSandbox)
            {
                TrySyncFromRealActiveDirectory(target);
            }

            _db.Save(KeyProfiles, _profiles);
            return CommandResult<DomainProfile>.Ok(target, $"Активный профиль переключён на «{target.Name}»");
        }
    }

    public CommandResult<DomainProfile> SaveProfile(DomainProfile profile, string? plainPassword)
    {
        lock (_sync)
        {
            if (!string.IsNullOrEmpty(plainPassword))
            {
                profile.EncryptedPassword = CredentialProtector.Encrypt(plainPassword);
            }

            var existing = _profiles.FirstOrDefault(p => p.Id == profile.Id);
            if (existing != null)
            {
                existing.Name = profile.Name;
                existing.DomainName = profile.DomainName;
                existing.DcHost = profile.DcHost;
                existing.Port = profile.Port;
                existing.UseSsl = profile.UseSsl;
                existing.UseCurrentUserSso = profile.UseCurrentUserSso;
                existing.Username = profile.Username;
                existing.IsSandbox = profile.IsSandbox;
                if (!string.IsNullOrEmpty(profile.EncryptedPassword))
                    existing.EncryptedPassword = profile.EncryptedPassword;
            }
            else
            {
                profile.Id = "prof-" + Guid.NewGuid().ToString("N")[..8];
                _profiles.Add(profile);
            }

            var savedProfile = existing ?? profile;
            foreach (var p in _profiles)
                p.IsActive = p.Id == savedProfile.Id;

            if (!savedProfile.IsSandbox)
            {
                TrySyncFromRealActiveDirectory(savedProfile);
            }

            PersistAll();
            return CommandResult<DomainProfile>.Ok(savedProfile, $"Профиль «{savedProfile.Name}» ({savedProfile.DomainName}) сохранён и активирован");
        }
    }

    public CommandResult<DomainProfile> DetectCurrentWindowsDomain()
    {
        var detected = RealActiveDirectoryConnector.DetectCurrentWindowsDomain();
        return CommandResult<DomainProfile>.Ok(detected, $"Обнаружен домен текущей машины: {detected.DomainName} (DC: {detected.DcHost})");
    }

    public CommandResult<string> TestConnection(DomainProfile profile, string? plainPassword)
    {
        return RealActiveDirectoryConnector.TestConnection(profile, plainPassword);
    }

    public CommandResult<int> SyncActiveDomain()
    {
        lock (_sync)
        {
            var active = GetActiveProfile();
            if (active.IsSandbox)
                return CommandResult<int>.Ok(_sandboxState.Users.Count, "Активен режим Песочницы AD");

            return TrySyncFromRealActiveDirectory(active);
        }
    }

    public CommandResult<bool> ResetSandboxData()
    {
        lock (_sync)
        {
            _sandboxState = SandboxSeeder.CreateInitialState();
            _templates = SandboxSeeder.CreateDefaultTemplates();
            _auditLogs = CreateInitialAuditLogs();
            PersistAll();
            return CommandResult<bool>.Ok(true, "Песочница Satella Sandbox AD сброшена к эталонному состоянию домена corp.satella.local");
        }
    }

    private CommandResult<int> TrySyncFromRealActiveDirectory(DomainProfile profile)
    {
        try
        {
            var loadedState = RealActiveDirectoryConnector.LoadFromRealAd(profile, out var rootDn);
            _liveState = loadedState;
            _db.Save(KeyLiveCache, _liveState);

            var msg = $"Синхронизирован боевой домен {profile.DomainName} ({rootDn}): {loadedState.Users.Count} польз., {loadedState.Groups.Count} групп, {loadedState.Computers.Count} ПК, {loadedState.FlatOus.Count} OU";
            RecordAudit("SyncRealAD", rootDn, profile.DomainName, "domain", msg, $"Get-ADDomain -Server \"{profile.DcHost}\"");
            return CommandResult<int>.Ok(loadedState.Users.Count, msg);
        }
        catch (Exception ex)
        {
            var err = $"Не удалось загрузить каталог с контроллера {profile.DcHost}:{profile.Port} ({ex.Message})";
            RecordAudit("ConnectADWarning", profile.DcHost, profile.DomainName, "domain", err, $"Test-NetConnection -ComputerName \"{profile.DcHost}\" -Port {profile.Port}");
            return CommandResult<int>.Fail(err);
        }
    }

    // ---------------------------------------------------------
    // DASHBOARD & OU TREE
    // ---------------------------------------------------------
    public DashboardStats GetDashboardStats()
    {
        lock (_sync)
        {
            var profile = GetActiveProfile();
            var now = DateTime.UtcNow;
            var expiringUsers = _state.Users
                .Where(u => u.Enabled && !u.PasswordNeverExpires && u.PasswordExpiresAt.HasValue && (u.PasswordExpiresAt.Value - now).TotalDays <= 7)
                .OrderBy(u => u.PasswordExpiresAt)
                .ToList();

            var lockedUsers = _state.Users.Where(u => u.LockedOut).ToList();
            var inactiveComps = _state.Computers
                .Where(c => !c.IsOnline || (c.LastLogon.HasValue && (now - c.LastLogon.Value).TotalDays >= 30))
                .ToList();

            return new DashboardStats
            {
                DomainName = profile.DomainName,
                DcHost = profile.DcHost,
                IsSandbox = profile.IsSandbox,
                TotalUsers = _state.Users.Count,
                ActiveUsers = _state.Users.Count(u => u.Enabled && !u.LockedOut),
                LockedOutUsers = lockedUsers.Count,
                DisabledUsers = _state.Users.Count(u => !u.Enabled),
                ExpiringPasswordsCount = expiringUsers.Count,
                TotalGroups = _state.Groups.Count,
                TotalComputers = _state.Computers.Count,
                OnlineComputers = _state.Computers.Count(c => c.IsOnline),
                TotalOus = _state.FlatOus.Count,
                TotalGpos = _state.Gpos.Count,
                RecycleBinCount = _state.RecycleBin.Count,
                LockedUsersList = lockedUsers,
                ExpiringPasswordUsers = expiringUsers,
                InactiveComputers = inactiveComps,
                RecentAuditLogs = _auditLogs.Take(10).ToList()
            };
        }
    }

    public List<OuNode> GetOuTree()
    {
        lock (_sync)
        {
            var clones = _state.FlatOus.Select(o => new OuNode
            {
                Id = o.Id,
                Name = o.Name,
                DistinguishedName = o.DistinguishedName,
                ParentDn = o.ParentDn,
                Description = o.Description,
                ProtectedFromAccidentalDeletion = o.ProtectedFromAccidentalDeletion,
                LinkedGpoIds = o.LinkedGpoIds.ToList(),
                UserCount = _state.Users.Count(u => string.Equals(u.OuDn, o.DistinguishedName, StringComparison.OrdinalIgnoreCase)),
                ComputerCount = _state.Computers.Count(c => string.Equals(c.OuDn, o.DistinguishedName, StringComparison.OrdinalIgnoreCase)),
                GroupCount = _state.Groups.Count(g => string.Equals(g.OuDn, o.DistinguishedName, StringComparison.OrdinalIgnoreCase)),
                Children = new List<OuNode>()
            }).ToList();

            var byDn = clones.ToDictionary(o => o.DistinguishedName, StringComparer.OrdinalIgnoreCase);
            var roots = new List<OuNode>();

            foreach (var node in clones)
            {
                if (!string.IsNullOrEmpty(node.ParentDn) && byDn.TryGetValue(node.ParentDn, out var parent))
                {
                    parent.Children.Add(node);
                }
                else
                {
                    roots.Add(node);
                }
            }

            return roots;
        }
    }

    public CommandResult<OuNode> CreateOu(CreateOuRequest request)
    {
        lock (_sync)
        {
            var dn = $"OU={request.Name},{request.ParentDn}";
            if (_state.FlatOus.Any(o => string.Equals(o.DistinguishedName, dn, StringComparison.OrdinalIgnoreCase)))
                return CommandResult<OuNode>.Fail($"Подразделение {dn} уже существует");

            var node = new OuNode
            {
                Id = "ou-" + Guid.NewGuid().ToString("N")[..6],
                Name = request.Name,
                DistinguishedName = dn,
                ParentDn = request.ParentDn,
                Description = request.Description,
                ProtectedFromAccidentalDeletion = request.ProtectedFromAccidentalDeletion
            };

            var active = GetActiveProfile();
            if (!active.IsSandbox)
            {
                RealActiveDirectoryConnector.CreateOuInAd(active, request);
            }

            _state.FlatOus.Add(node);
            var ps = $"New-ADOrganizationalUnit -Name \"{request.Name}\" -Path \"{request.ParentDn}\" -Description \"{request.Description}\" -ProtectedFromAccidentalDeletion:${(request.ProtectedFromAccidentalDeletion ? "true" : "false")}";
            var audit = RecordAudit("CreateOU", dn, request.Name, "organizationalUnit", $"Создано подразделение {request.Name}", ps);
            PersistAll();
            return CommandResult<OuNode>.Ok(node, $"Подразделение «{request.Name}» создано", ps, audit.Id);
        }
    }

    // ---------------------------------------------------------
    // USERS
    // ---------------------------------------------------------
    public List<AdUser> GetUsers(string? ouDn = null, string? search = null, string? statusFilter = null)
    {
        lock (_sync)
        {
            IEnumerable<AdUser> query = _state.Users;

            if (!string.IsNullOrWhiteSpace(ouDn) && !string.Equals(ouDn, SandboxSeeder.RootDn, StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(u => u.OuDn.EndsWith(ouDn, StringComparison.OrdinalIgnoreCase));
            }

            if (!string.IsNullOrWhiteSpace(statusFilter))
            {
                var now = DateTime.UtcNow;
                query = statusFilter.ToLowerInvariant() switch
                {
                    "locked" => query.Where(u => u.LockedOut),
                    "disabled" => query.Where(u => !u.Enabled),
                    "active" => query.Where(u => u.Enabled && !u.LockedOut),
                    "expiring" => query.Where(u => u.Enabled && !u.PasswordNeverExpires && u.PasswordExpiresAt.HasValue && (u.PasswordExpiresAt.Value - now).TotalDays <= 7),
                    _ => query
                };
            }

            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                query = query.Where(u =>
                    u.DisplayName.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    u.SamAccountName.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    u.Email.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    u.Title.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    u.Department.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    u.Telephone.Contains(q, StringComparison.OrdinalIgnoreCase));
            }

            return query.OrderBy(u => u.DisplayName).ToList();
        }
    }

    public AdUser? GetUserById(string id)
    {
        lock (_sync)
        {
            return _state.Users.FirstOrDefault(u => u.Id == id || string.Equals(u.SamAccountName, id, StringComparison.OrdinalIgnoreCase));
        }
    }

    public CommandResult<AdUser> CreateUser(CreateUserRequest request)
    {
        lock (_sync)
        {
            if (_state.Users.Any(u => string.Equals(u.SamAccountName, request.SamAccountName, StringComparison.OrdinalIgnoreCase)))
                return CommandResult<AdUser>.Fail($"Пользователь с логином «{request.SamAccountName}» уже существует в домене");

            var ouDn = string.IsNullOrWhiteSpace(request.OuDn) ? $"OU=Engineering,OU=HQ Moscow,{SandboxSeeder.RootDn}" : request.OuDn;
            var displayName = string.IsNullOrWhiteSpace(request.DisplayName) ? $"{request.Surname} {request.GivenName}".Trim() : request.DisplayName;
            var dn = $"CN={displayName},{ouDn}";

            var user = new AdUser
            {
                Id = "usr-" + Guid.NewGuid().ToString("N")[..6],
                SamAccountName = request.SamAccountName,
                UserPrincipalName = $"{request.SamAccountName}@corp.satella.local",
                DisplayName = displayName,
                GivenName = request.GivenName,
                Surname = request.Surname,
                Title = request.Title,
                Department = request.Department,
                Company = string.IsNullOrWhiteSpace(request.Company) ? "Satella Enterprise" : request.Company,
                Office = string.IsNullOrWhiteSpace(request.Office) ? "HQ Moscow Tower A" : request.Office,
                Email = string.IsNullOrWhiteSpace(request.Email) ? $"{request.SamAccountName}@satella.io" : request.Email,
                Telephone = request.Telephone,
                Mobile = request.Telephone,
                DistinguishedName = dn,
                OuDn = ouDn,
                Enabled = request.Enabled,
                LockedOut = false,
                MustChangePasswordNextLogon = request.MustChangePasswordNextLogon,
                PasswordExpiresAt = DateTime.UtcNow.AddDays(90),
                CreatedAt = DateTime.UtcNow,
                Description = $"{request.Title} ({request.Department})",
                MemberOf = request.MemberOf ?? new List<string>(),
                CustomAttributes = new Dictionary<string, string>
                {
                    ["employeeID"] = $"EMP-{Random.Shared.Next(2000, 9999)}",
                    ["sAMAccountType"] = "805306368",
                    ["userAccountControl"] = request.Enabled ? "512" : "514",
                    ["badPwdCount"] = "0",
                    ["logonCount"] = "0",
                    ["homeDirectory"] = $@"\\fs01.corp.satella.local\profiles\{request.SamAccountName}",
                    ["homeDrive"] = "H:"
                }
            };

            var active = GetActiveProfile();
            if (!active.IsSandbox)
            {
                RealActiveDirectoryConnector.CreateUserInAd(active, user, request.Password);
            }

            _state.Users.Add(user);
            SyncUserGroupMemberships(user);

            var ps = PowerShellGenerator.ForCreateUser(user, request.Password);
            var audit = RecordAudit("CreateUser", user.DistinguishedName, $"{user.DisplayName} ({user.SamAccountName})", "user", $"Создан новый пользователь {user.DisplayName} в {user.OuDn}", ps);
            PersistAll();

            return CommandResult<AdUser>.Ok(user, $"Учётная запись «{user.DisplayName}» ({user.SamAccountName}) создана", ps, audit.Id);
        }
    }

    public CommandResult<AdUser> UpdateUser(UpdateUserRequest request)
    {
        lock (_sync)
        {
            var user = _state.Users.FirstOrDefault(u => u.Id == request.Id);
            if (user == null)
                return CommandResult<AdUser>.Fail("Пользователь не найден");

            var snapshot = JsonSerializer.Deserialize<AdUser>(JsonSerializer.Serialize(user));

            user.DisplayName = request.DisplayName;
            user.GivenName = request.GivenName;
            user.Surname = request.Surname;
            user.Title = request.Title;
            user.Department = request.Department;
            user.Company = request.Company;
            user.Office = request.Office;
            user.Email = request.Email;
            user.Telephone = request.Telephone;
            user.Description = request.Description;
            user.Enabled = request.Enabled;
            user.PasswordNeverExpires = request.PasswordNeverExpires;
            if (!string.IsNullOrWhiteSpace(request.SamAccountName))
                user.SamAccountName = request.SamAccountName;
            if (!string.IsNullOrWhiteSpace(request.UserPrincipalName))
                user.UserPrincipalName = request.UserPrincipalName;
            if (request.Mobile != null)
                user.Mobile = request.Mobile;
            if (request.ManagerDn != null)
                user.ManagerDn = request.ManagerDn;
            if (request.MustChangePasswordNextLogon.HasValue)
                user.MustChangePasswordNextLogon = request.MustChangePasswordNextLogon.Value;
            if (request.LockedOut.HasValue)
                user.LockedOut = request.LockedOut.Value;
            user.MemberOf = request.MemberOf ?? new List<string>();
            if (request.CustomAttributes != null)
            {
                user.CustomAttributes = new Dictionary<string, string>(request.CustomAttributes);
            }

            var active = GetActiveProfile();
            if (!active.IsSandbox)
            {
                RealActiveDirectoryConnector.UpdateUserInAd(active, user);
            }

            SyncUserGroupMemberships(user);

            var ps = PowerShellGenerator.ForUpdateUser(user);
            var audit = RecordAudit("UpdateUser", user.DistinguishedName, $"{user.DisplayName} ({user.SamAccountName})", "user", $"Обновлены атрибуты и членство в группах для {user.DisplayName}", ps, snapshot);
            PersistAll();

            return CommandResult<AdUser>.Ok(user, $"Карточка пользователя «{user.DisplayName}» сохранена", ps, audit.Id);
        }
    }

    private void SyncUserGroupMemberships(AdUser user)
    {
        foreach (var group in _state.Groups)
        {
            bool shouldBeMember = user.MemberOf.Contains(group.DistinguishedName, StringComparer.OrdinalIgnoreCase);
            bool currentlyMember = group.Members.Contains(user.DistinguishedName, StringComparer.OrdinalIgnoreCase);

            if (shouldBeMember && !currentlyMember)
                group.Members.Add(user.DistinguishedName);
            else if (!shouldBeMember && currentlyMember)
                group.Members.RemoveAll(m => string.Equals(m, user.DistinguishedName, StringComparison.OrdinalIgnoreCase));
        }
    }

    public CommandResult<AdUser> ResetPassword(ResetPasswordRequest request)
    {
        lock (_sync)
        {
            var user = _state.Users.FirstOrDefault(u => u.Id == request.UserId);
            if (user == null)
                return CommandResult<AdUser>.Fail("Пользователь не найден");

            var snapshot = JsonSerializer.Deserialize<AdUser>(JsonSerializer.Serialize(user));
            user.MustChangePasswordNextLogon = request.MustChangeNextLogon;
            user.PasswordExpiresAt = DateTime.UtcNow.AddDays(90);
            if (request.UnlockAccount)
            {
                user.LockedOut = false;
                user.CustomAttributes["badPwdCount"] = "0";
            }

            var active = GetActiveProfile();
            if (!active.IsSandbox)
            {
                RealActiveDirectoryConnector.ResetPasswordInAd(active, user.DistinguishedName, request.NewPassword, request.MustChangeNextLogon, request.UnlockAccount);
            }

            var ps = PowerShellGenerator.ForResetPassword(user.SamAccountName, request.MustChangeNextLogon);
            var audit = RecordAudit("ResetPassword", user.DistinguishedName, $"{user.DisplayName} ({user.SamAccountName})", "user", $"Сброшен пароль для {user.DisplayName} (смена при входе: {(request.MustChangeNextLogon ? "Да" : "Нет")})", ps, snapshot);
            PersistAll();

            return CommandResult<AdUser>.Ok(user, $"Пароль для «{user.DisplayName}» успешно сброшен", ps, audit.Id);
        }
    }

    public CommandResult<AdUser> UnlockUser(string userId)
    {
        lock (_sync)
        {
            var user = _state.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
                return CommandResult<AdUser>.Fail("Пользователь не найден");

            var snapshot = JsonSerializer.Deserialize<AdUser>(JsonSerializer.Serialize(user));
            user.LockedOut = false;
            user.CustomAttributes["badPwdCount"] = "0";

            var active = GetActiveProfile();
            if (!active.IsSandbox)
            {
                RealActiveDirectoryConnector.UnlockUserInAd(active, user.DistinguishedName);
            }

            var ps = PowerShellGenerator.ForUnlockUser(user.SamAccountName);
            var audit = RecordAudit("UnlockUser", user.DistinguishedName, $"{user.DisplayName} ({user.SamAccountName})", "user", $"Разблокирована учётная запись {user.DisplayName}", ps, snapshot);
            PersistAll();

            return CommandResult<AdUser>.Ok(user, $"Учётная запись «{user.DisplayName}» разблокирована", ps, audit.Id);
        }
    }

    public CommandResult<AdUser> ToggleUserEnabled(string userId, bool enabled)
    {
        lock (_sync)
        {
            var user = _state.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
                return CommandResult<AdUser>.Fail("Пользователь не найден");

            var snapshot = JsonSerializer.Deserialize<AdUser>(JsonSerializer.Serialize(user));
            user.Enabled = enabled;
            user.CustomAttributes["userAccountControl"] = enabled ? "512" : "514";

            var active = GetActiveProfile();
            if (!active.IsSandbox)
            {
                RealActiveDirectoryConnector.SetUserEnabledInAd(active, user.DistinguishedName, enabled);
            }

            var ps = PowerShellGenerator.ForSetUserEnabled(user.SamAccountName, enabled);
            var audit = RecordAudit(enabled ? "EnableUser" : "DisableUser", user.DistinguishedName, $"{user.DisplayName} ({user.SamAccountName})", "user", $"{(enabled ? "Включена" : "Отключена")} учётная запись {user.DisplayName}", ps, snapshot);
            PersistAll();

            return CommandResult<AdUser>.Ok(user, $"Учётная запись «{user.DisplayName}» {(enabled ? "включена" : "отключена")}", ps, audit.Id);
        }
    }

    public CommandResult<AdUser> OffboardUser(string userId)
    {
        lock (_sync)
        {
            var user = _state.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
                return CommandResult<AdUser>.Fail("Пользователь не найден");

            var snapshot = JsonSerializer.Deserialize<AdUser>(JsonSerializer.Serialize(user));
            var disabledOu = $"OU=Disabled Users,{SandboxSeeder.RootDn}";
            var ps = PowerShellGenerator.ForOffboardUser(user, disabledOu);

            user.Enabled = false;
            user.LockedOut = false;
            user.MemberOf.Clear();
            user.OuDn = disabledOu;
            user.DistinguishedName = $"CN={user.DisplayName},{disabledOu}";
            user.Description = $"Уволен (Offboarded) {DateTime.Now:yyyy-MM-dd HH:mm} — бывш. {user.Title} ({user.Department})";
            user.CustomAttributes["userAccountControl"] = "514";
            user.CustomAttributes["msExchHideFromAddressLists"] = "TRUE";

            SyncUserGroupMemberships(user);

            var audit = RecordAudit("OffboardUser", user.DistinguishedName, $"{user.DisplayName} ({user.SamAccountName})", "user", $"Выполнен полный оффбординг сотрудника {user.DisplayName}: отключение, отзыв всех групп и перенос в OU=Disabled Users (доступен откат Rollback)", ps, snapshot);
            PersistAll();

            return CommandResult<AdUser>.Ok(user, $"Оффбординг сотрудника «{user.DisplayName}» выполнен (снимок групп сохранён для возможного отката)", ps, audit.Id);
        }
    }

    public CommandResult<bool> DeleteUser(string userId)
    {
        lock (_sync)
        {
            var user = _state.Users.FirstOrDefault(u => u.Id == userId);
            if (user == null)
                return CommandResult<bool>.Fail("Пользователь не найден");

            var snapshotJson = JsonSerializer.Serialize(user);
            _state.Users.Remove(user);

            _state.RecycleBin.Insert(0, new RecycleBinObject
            {
                Id = "rec-" + Guid.NewGuid().ToString("N")[..6],
                Name = user.DisplayName,
                SamAccountName = user.SamAccountName,
                ObjectClass = "user",
                OriginalDn = user.DistinguishedName,
                LastKnownParentDn = user.OuDn,
                DeletedAt = DateTime.UtcNow,
                DeletedBy = GetActiveProfile().Username,
                SerializedSnapshotJson = snapshotJson
            });

            var ps = $"Remove-ADUser -Identity \"{user.SamAccountName}\" -Confirm:$false";
            var audit = RecordAudit("DeleteUser", user.DistinguishedName, $"{user.DisplayName} ({user.SamAccountName})", "user", $"Удалена учётная запись {user.DisplayName} (перемещена в Корзину AD)", ps);
            PersistAll();

            return CommandResult<bool>.Ok(true, $"Пользователь «{user.DisplayName}» удалён и помещён в Корзину AD", ps, audit.Id);
        }
    }

    public CommandResult<int> BulkUserAction(BulkUserActionRequest request)
    {
        lock (_sync)
        {
            var targets = _state.Users.Where(u => request.UserIds.Contains(u.Id)).ToList();
            if (targets.Count == 0)
                return CommandResult<int>.Fail("Не выбрано ни одного пользователя");

            var psLines = new List<string> { $"# Массовая операция ({request.Action}) над {targets.Count} объектами" };

            foreach (var u in targets)
            {
                switch (request.Action.ToLowerInvariant())
                {
                    case "unlock":
                        u.LockedOut = false;
                        u.CustomAttributes["badPwdCount"] = "0";
                        psLines.Add($"Unlock-ADAccount -Identity \"{u.SamAccountName}\"");
                        break;
                    case "enable":
                        u.Enabled = true;
                        u.CustomAttributes["userAccountControl"] = "512";
                        psLines.Add($"Enable-ADAccount -Identity \"{u.SamAccountName}\"");
                        break;
                    case "disable":
                        u.Enabled = false;
                        u.CustomAttributes["userAccountControl"] = "514";
                        psLines.Add($"Disable-ADAccount -Identity \"{u.SamAccountName}\"");
                        break;
                    case "move":
                        if (!string.IsNullOrWhiteSpace(request.TargetOuDn))
                        {
                            var oldDn = u.DistinguishedName;
                            u.OuDn = request.TargetOuDn;
                            u.DistinguishedName = $"CN={u.DisplayName},{request.TargetOuDn}";
                            psLines.Add($"Move-ADObject -Identity \"{oldDn}\" -TargetPath \"{request.TargetOuDn}\"");
                        }
                        break;
                    case "addgroup":
                        if (!string.IsNullOrWhiteSpace(request.GroupDn) && !u.MemberOf.Contains(request.GroupDn, StringComparer.OrdinalIgnoreCase))
                        {
                            u.MemberOf.Add(request.GroupDn);
                            SyncUserGroupMemberships(u);
                            psLines.Add($"Add-ADGroupMember -Identity \"{request.GroupDn}\" -Members \"{u.SamAccountName}\"");
                        }
                        break;
                }
            }

            var ps = string.Join(Environment.NewLine, psLines);
            var audit = RecordAudit("BulkAction", request.TargetOuDn ?? SandboxSeeder.RootDn, $"{targets.Count} пользователей", "user", $"Массовая операция «{request.Action}» выполнена для {targets.Count} учётных записей", ps);
            PersistAll();

            return CommandResult<int>.Ok(targets.Count, $"Операция успешно применена к {targets.Count} учётным записям", ps, audit.Id);
        }
    }

    // ---------------------------------------------------------
    // DRAG & DROP MOVE OBJECT TO OU
    // ---------------------------------------------------------
    public CommandResult<bool> MoveObjectToOu(string objectId, string objectClass, string targetOuDn)
    {
        lock (_sync)
        {
            if (objectClass.Equals("user", StringComparison.OrdinalIgnoreCase))
            {
                var user = _state.Users.FirstOrDefault(u => u.Id == objectId);
                if (user == null)
                    return CommandResult<bool>.Fail("Пользователь не найден");

                var snapshot = JsonSerializer.Deserialize<AdUser>(JsonSerializer.Serialize(user));
                var oldDn = user.DistinguishedName;
                user.OuDn = targetOuDn;
                user.DistinguishedName = $"CN={user.DisplayName},{targetOuDn}";

                var ps = PowerShellGenerator.ForMoveObject(oldDn, targetOuDn);
                var audit = RecordAudit("MoveObject", user.DistinguishedName, user.DisplayName, "user", $"Перемещён пользователь {user.DisplayName} в {targetOuDn}", ps, snapshot);
                PersistAll();
                return CommandResult<bool>.Ok(true, $"«{user.DisplayName}» перемещён в {targetOuDn}", ps, audit.Id);
            }
            else if (objectClass.Equals("computer", StringComparison.OrdinalIgnoreCase))
            {
                var comp = _state.Computers.FirstOrDefault(c => c.Id == objectId);
                if (comp == null)
                    return CommandResult<bool>.Fail("Компьютер не найден");

                var oldDn = comp.DistinguishedName;
                comp.OuDn = targetOuDn;
                comp.DistinguishedName = $"CN={comp.Name},{targetOuDn}";

                var ps = PowerShellGenerator.ForMoveObject(oldDn, targetOuDn);
                var audit = RecordAudit("MoveObject", comp.DistinguishedName, comp.Name, "computer", $"Перемещён компьютер {comp.Name} в {targetOuDn}", ps);
                PersistAll();
                return CommandResult<bool>.Ok(true, $"Хост «{comp.Name}» перемещён в {targetOuDn}", ps, audit.Id);
            }

            return CommandResult<bool>.Fail("Неизвестный класс объекта");
        }
    }

    // ---------------------------------------------------------
    // GROUPS
    // ---------------------------------------------------------
    public List<AdGroup> GetGroups(string? ouDn = null, string? search = null)
    {
        lock (_sync)
        {
            IEnumerable<AdGroup> query = _state.Groups;
            if (!string.IsNullOrWhiteSpace(ouDn) && !string.Equals(ouDn, SandboxSeeder.RootDn, StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(g => g.OuDn.EndsWith(ouDn, StringComparison.OrdinalIgnoreCase));
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                query = query.Where(g =>
                    g.DisplayName.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    g.SamAccountName.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    g.Description.Contains(q, StringComparison.OrdinalIgnoreCase));
            }
            return query.OrderBy(g => g.DisplayName).ToList();
        }
    }

    public CommandResult<AdGroup> CreateGroup(CreateGroupRequest request)
    {
        lock (_sync)
        {
            var ou = string.IsNullOrWhiteSpace(request.OuDn) ? $"OU=Security Groups,{SandboxSeeder.RootDn}" : request.OuDn;
            var dn = $"CN={request.SamAccountName},{ou}";
            var grp = new AdGroup
            {
                Id = "grp-" + Guid.NewGuid().ToString("N")[..6],
                SamAccountName = request.SamAccountName,
                DisplayName = string.IsNullOrWhiteSpace(request.DisplayName) ? request.SamAccountName : request.DisplayName,
                DistinguishedName = dn,
                OuDn = ou,
                GroupScope = request.GroupScope,
                GroupCategory = request.GroupCategory,
                Description = request.Description,
                Email = request.Email,
                CreatedAt = DateTime.UtcNow
            };
            _state.Groups.Add(grp);

            var ps = $"New-ADGroup -Name \"{grp.SamAccountName}\" -GroupScope {grp.GroupScope} -GroupCategory {grp.GroupCategory} -Path \"{ou}\" -Description \"{grp.Description}\"";
            var audit = RecordAudit("CreateGroup", dn, grp.SamAccountName, "group", $"Создана группа {grp.SamAccountName} ({grp.GroupCategory} / {grp.GroupScope})", ps);
            PersistAll();
            return CommandResult<AdGroup>.Ok(grp, $"Группа «{grp.SamAccountName}» создана", ps, audit.Id);
        }
    }

    public CommandResult<AdGroup> UpdateGroupMembers(string groupId, List<string> memberDns)
    {
        lock (_sync)
        {
            var grp = _state.Groups.FirstOrDefault(g => g.Id == groupId);
            if (grp == null)
                return CommandResult<AdGroup>.Fail("Группа не найдена");

            grp.Members = memberDns.Distinct(StringComparer.OrdinalIgnoreCase).ToList();
            foreach (var u in _state.Users)
            {
                bool inGroup = grp.Members.Contains(u.DistinguishedName, StringComparer.OrdinalIgnoreCase);
                bool hasGroup = u.MemberOf.Contains(grp.DistinguishedName, StringComparer.OrdinalIgnoreCase);
                if (inGroup && !hasGroup)
                    u.MemberOf.Add(grp.DistinguishedName);
                else if (!inGroup && hasGroup)
                    u.MemberOf.RemoveAll(x => string.Equals(x, grp.DistinguishedName, StringComparison.OrdinalIgnoreCase));
            }

            var ps = $"# Обновление состава группы {grp.SamAccountName}\nSet-ADGroup -Identity \"{grp.SamAccountName}\" -Replace @{{member=@({string.Join(",", grp.Members.Select(m => $"\"{m}\""))})}}";
            var audit = RecordAudit("UpdateGroupMembers", grp.DistinguishedName, grp.SamAccountName, "group", $"Обновлён состав участников группы {grp.SamAccountName} ({grp.Members.Count} чел.)", ps);
            PersistAll();
            return CommandResult<AdGroup>.Ok(grp, $"Состав группы «{grp.SamAccountName}» обновлён", ps, audit.Id);
        }
    }

    // ---------------------------------------------------------
    // COMPUTERS & REMOTE MANAGEMENT & LAPS
    // ---------------------------------------------------------
    public List<AdComputer> GetComputers(string? ouDn = null, string? search = null)
    {
        lock (_sync)
        {
            IEnumerable<AdComputer> query = _state.Computers;
            if (!string.IsNullOrWhiteSpace(ouDn) && !string.Equals(ouDn, SandboxSeeder.RootDn, StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(c => c.OuDn.EndsWith(ouDn, StringComparison.OrdinalIgnoreCase));
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                var q = search.Trim();
                query = query.Where(c =>
                    c.Name.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    c.IpAddress.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    c.LoggedOnUser.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    c.Description.Contains(q, StringComparison.OrdinalIgnoreCase) ||
                    c.OperatingSystem.Contains(q, StringComparison.OrdinalIgnoreCase));
            }
            return query.OrderByDescending(c => c.IsOnline).ThenBy(c => c.Name).ToList();
        }
    }

    public CommandResult<AdComputer> RotateLapsPassword(string computerId, int expirationDays)
    {
        lock (_sync)
        {
            var comp = _state.Computers.FirstOrDefault(c => c.Id == computerId);
            if (comp == null)
                return CommandResult<AdComputer>.Fail("Хост не найден");

            var active = GetActiveProfile();
            if (!active.IsSandbox)
            {
                try { RealActiveDirectoryConnector.ExpireLapsPasswordInAd(active, comp.DistinguishedName); } catch { }
            }

            const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
            var newPwd = "Laps#" + new string(Enumerable.Range(0, 12).Select(_ => chars[Random.Shared.Next(chars.Length)]).ToArray());
            comp.LapsPassword = newPwd;
            comp.LapsExpiration = DateTime.UtcNow.AddDays(expirationDays > 0 ? expirationDays : 14);

            var ps = $"# Принудительная ротация пароля локального администратора Windows LAPS / Legacy LAPS\nReset-LapsPassword -Identity \"{comp.Name}\"\nInvoke-GPUpdate -Computer \"{comp.DnsHostName}\" -Target \"Computer\" -Force";
            var audit = RecordAudit("RotateLAPS", comp.DistinguishedName, comp.Name, "computer", $"Выполнена принудительная ротация пароля локального администратора LAPS на хосте {comp.Name} (срок действия: {expirationDays} дн.)", ps);
            PersistAll();

            return CommandResult<AdComputer>.Ok(comp, $"Пароль LAPS для хоста «{comp.Name}» принудительно ротирован", ps, audit.Id);
        }
    }

    public CommandResult<string> LaunchRemoteSession(string computerId, int sessionId, string protocol, bool control)
    {
        lock (_sync)
        {
            var comp = _state.Computers.FirstOrDefault(c => c.Id == computerId);
            if (comp == null)
                return CommandResult<string>.Fail("Хост не найден");

            var profile = GetActiveProfile();
            string ps;

            if (protocol.Equals("shadow", StringComparison.OrdinalIgnoreCase))
            {
                ps = PowerShellGenerator.ForShadowRdp(comp.DnsHostName, sessionId, control);
                if (!profile.IsSandbox)
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = "mstsc.exe",
                            Arguments = $"/v:{comp.IpAddress} /shadow:{sessionId}{(control ? " /control" : "")} /noConsentPrompt",
                            UseShellExecute = true
                        });
                    }
                    catch { /* Ignored if mstsc blocked */ }
                }
            }
            else
            {
                ps = $"# Стандартное RDP подключение к {comp.DnsHostName}\nmstsc.exe /v:{comp.IpAddress}";
                if (!profile.IsSandbox)
                {
                    try
                    {
                        Process.Start(new ProcessStartInfo
                        {
                            FileName = "mstsc.exe",
                            Arguments = $"/v:{comp.IpAddress}",
                            UseShellExecute = true
                        });
                    }
                    catch { /* Ignored */ }
                }
            }

            var modeDesc = protocol.Equals("shadow", StringComparison.OrdinalIgnoreCase)
                ? $"Shadow RDP (Сессия #{sessionId}, {(control ? "Управление" : "Только просмотр")})"
                : "Прямое RDP-подключение";

            var audit = RecordAudit("RemoteConnect", comp.DistinguishedName, comp.Name, "computer", $"Инициировано подключение {modeDesc} к хосту {comp.Name} ({comp.IpAddress})", ps);
            return CommandResult<string>.Ok(ps, $"Сессия {modeDesc} к «{comp.Name}» ({comp.IpAddress}) запущена", ps, audit.Id);
        }
    }

    public CommandResult<bool> PowerActionComputer(string computerId, string action, string reason)
    {
        lock (_sync)
        {
            var comp = _state.Computers.FirstOrDefault(c => c.Id == computerId);
            if (comp == null)
                return CommandResult<bool>.Fail("Компьютер не найден");

            var ps = PowerShellGenerator.ForRemoteReboot(comp.DnsHostName, true, reason);
            if (action.Equals("shutdown", StringComparison.OrdinalIgnoreCase))
            {
                comp.IsOnline = false;
                comp.Uptime = "Offline";
                ps = $"Stop-Computer -ComputerName \"{comp.DnsHostName}\" -Force";
            }
            else
            {
                comp.IsOnline = true;
                comp.Uptime = "0d 0h 1m";
            }

            var audit = RecordAudit("HostPower", comp.DistinguishedName, comp.Name, "computer", $"Отправлена команда питания «{action}» на хост {comp.Name}. Причина: {reason}", ps);
            PersistAll();
            return CommandResult<bool>.Ok(true, $"Команда «{action}» успешно отправлена на {comp.Name}", ps, audit.Id);
        }
    }

    public List<RemoteProcessInfo> GetRemoteProcesses(string computerId)
    {
        lock (_sync)
        {
            var comp = _state.Computers.FirstOrDefault(c => c.Id == computerId);
            var user = comp?.LoggedOnUser ?? "CORP\\user";
            return new List<RemoteProcessInfo>
            {
                new() { Pid = 4812, Name = "1cv8c.exe", CpuPercent = 18.4, MemoryMb = 942.5, Username = user, WindowTitle = "1С:Предприятие 8.3 — Управление холдингом" },
                new() { Pid = 7204, Name = "chrome.exe", CpuPercent = 6.2, MemoryMb = 1280.0, Username = user, WindowTitle = "Корпоративный портал Satella — Google Chrome" },
                new() { Pid = 3190, Name = "OUTLOOK.EXE", CpuPercent = 1.8, MemoryMb = 415.2, Username = user, WindowTitle = "Входящие — Microsoft Outlook" },
                new() { Pid = 1940, Name = "explorer.exe", CpuPercent = 0.5, MemoryMb = 184.0, Username = user, WindowTitle = "Проводник Windows" },
                new() { Pid = 1120, Name = "klnagent.exe", CpuPercent = 0.3, MemoryMb = 92.4, Username = "SYSTEM", WindowTitle = "Kaspersky Security Center Network Agent" },
                new() { Pid = 884, Name = "svchost.exe (WinRM)", CpuPercent = 0.1, MemoryMb = 48.1, Username = "NETWORK SERVICE", WindowTitle = "Windows Remote Management (WS-Management)" }
            };
        }
    }

    public CommandResult<bool> KillRemoteProcess(string computerId, int pid)
    {
        lock (_sync)
        {
            var comp = _state.Computers.FirstOrDefault(c => c.Id == computerId);
            if (comp == null)
                return CommandResult<bool>.Fail("Хост не найден");

            var ps = $"Invoke-Command -ComputerName \"{comp.DnsHostName}\" -ScriptBlock {{ Stop-Process -Id {pid} -Force }}";
            var audit = RecordAudit("KillProcess", comp.DistinguishedName, comp.Name, "computer", $"Принудительно завершён процесс PID {pid} на хосте {comp.Name}", ps);
            return CommandResult<bool>.Ok(true, $"Процесс PID {pid} на хосте «{comp.Name}» завершён", ps, audit.Id);
        }
    }

    public List<RemoteServiceInfo> GetRemoteServices(string computerId)
    {
        return new List<RemoteServiceInfo>
        {
            new() { Name = "WinRM", DisplayName = "Windows Remote Management (WS-Management)", Status = "Running", StartType = "Automatic" },
            new() { Name = "TermService", DisplayName = "Remote Desktop Services (Службы удалённых рабочих столов)", Status = "Running", StartType = "Automatic" },
            new() { Name = "Spooler", DisplayName = "Print Spooler (Диспетчер печати)", Status = "Running", StartType = "Automatic" },
            new() { Name = "Netlogon", DisplayName = "Netlogon (Сетевой вход в систему)", Status = "Running", StartType = "Automatic" },
            new() { Name = "W32Time", DisplayName = "Windows Time (Служба времени Windows)", Status = "Running", StartType = "Automatic" },
            new() { Name = "RemoteRegistry", DisplayName = "Remote Registry (Удалённый реестр)", Status = "Stopped", StartType = "Manual" }
        };
    }

    public CommandResult<RemoteServiceInfo> ToggleRemoteService(string computerId, string serviceName, string action)
    {
        lock (_sync)
        {
            var comp = _state.Computers.FirstOrDefault(c => c.Id == computerId);
            if (comp == null)
                return CommandResult<RemoteServiceInfo>.Fail("Хост не найден");

            var ps = action.Equals("stop", StringComparison.OrdinalIgnoreCase)
                ? $"Invoke-Command -ComputerName \"{comp.DnsHostName}\" -ScriptBlock {{ Stop-Service -Name \"{serviceName}\" -Force }}"
                : $"Invoke-Command -ComputerName \"{comp.DnsHostName}\" -ScriptBlock {{ Restart-Service -Name \"{serviceName}\" -Force }}";

            var updated = new RemoteServiceInfo
            {
                Name = serviceName,
                DisplayName = serviceName,
                Status = action.Equals("stop", StringComparison.OrdinalIgnoreCase) ? "Stopped" : "Running",
                StartType = "Automatic"
            };

            var audit = RecordAudit("ManageService", comp.DistinguishedName, comp.Name, "computer", $"Выполнена команда «{action}» для службы {serviceName} на {comp.Name}", ps);
            return CommandResult<RemoteServiceInfo>.Ok(updated, $"Служба «{serviceName}» на {comp.Name}: {updated.Status}", ps, audit.Id);
        }
    }

    public List<RemoteEventLogEntry> GetRemoteEventLogs(string computerId)
    {
        return new List<RemoteEventLogEntry>
        {
            new() { EventId = 4625, Level = "Warning", LogName = "Security", Source = "Microsoft-Windows-Security-Auditing", TimeCreated = DateTime.UtcNow.AddMinutes(-18), Message = "An account failed to log on. Failure Reason: Unknown user name or bad password. Workstation Name: WS-FIN-101." },
            new() { EventId = 1000, Level = "Error", LogName = "Application", Source = "Application Error", TimeCreated = DateTime.UtcNow.AddHours(-2), Message = "Faulting application name: 1cv8c.exe, version: 8.3.24.1467, faulting module name: core83.dll, exception code: 0xc0000005." },
            new() { EventId = 1502, Level = "Information", LogName = "System", Source = "Microsoft-Windows-GroupPolicy", TimeCreated = DateTime.UtcNow.AddHours(-3), Message = "The Group Policy settings for the computer were processed successfully. New settings from 4 Group Policy objects were detected and applied." },
            new() { EventId = 7036, Level = "Information", LogName = "System", Source = "Service Control Manager", TimeCreated = DateTime.UtcNow.AddHours(-5), Message = "The Print Spooler service entered the running state." }
        };
    }

    public CommandResult<List<ScriptExecutionResult>> ExecuteScriptOnComputers(DeployScriptRequest request)
    {
        lock (_sync)
        {
            var targets = _state.Computers.Where(c => request.ComputerIds.Contains(c.Id)).ToList();
            if (targets.Count == 0)
                return CommandResult<List<ScriptExecutionResult>>.Fail("Не выбрано ни одного целевого хоста");

            var results = targets.Select(c => new ScriptExecutionResult
            {
                ComputerName = c.Name,
                IpAddress = c.IpAddress,
                Success = c.IsOnline,
                ExitCode = c.IsOnline ? 0 : 1,
                DurationMs = c.IsOnline ? Random.Shared.Next(180, 950) : 3000,
                Output = c.IsOnline
                    ? $"[{c.Name}] WinRM session established ({c.IpAddress}). Executed '{request.ScriptName}' -> ExitCode 0 (OK)."
                    : $"[{c.Name}] ERROR: WinRM connection timed out ({c.IpAddress} is offline)."
            }).ToList();

            var hostList = string.Join(", ", targets.Select(t => $"\"{t.DnsHostName}\""));
            var ps = $"# Массовое выполнение скрипта «{request.ScriptName}» через WinRM\nInvoke-Command -ComputerName @({hostList}) -ScriptBlock {{\n    {request.PowerShellCode.Replace("\n", "\n    ")}\n}}";
            var audit = RecordAudit("DeployScript", SandboxSeeder.RootDn, $"{targets.Count} хостов", "computer", $"Выполнен PowerShell-скрипт «{request.ScriptName}» на {targets.Count} компьютерах", ps);
            return CommandResult<List<ScriptExecutionResult>>.Ok(results, $"Скрипт «{request.ScriptName}» выполнен на {results.Count(r => r.Success)} из {results.Count} хостов", ps, audit.Id);
        }
    }

    // ---------------------------------------------------------
    // ONBOARDING TEMPLATES
    // ---------------------------------------------------------
    public List<OnboardingTemplate> GetTemplates()
    {
        lock (_sync)
        {
            return _templates.ToList();
        }
    }

    public CommandResult<OnboardingTemplate> SaveTemplate(OnboardingTemplate template)
    {
        lock (_sync)
        {
            var existing = _templates.FirstOrDefault(t => t.Id == template.Id);
            if (existing != null)
            {
                existing.Name = template.Name;
                existing.Description = template.Description;
                existing.RoleCategory = template.RoleCategory;
                existing.TargetOuDn = template.TargetOuDn;
                existing.Title = template.Title;
                existing.Department = template.Department;
                existing.Office = template.Office;
                existing.DefaultGroups = template.DefaultGroups;
                existing.MustChangePassword = template.MustChangePassword;
            }
            else
            {
                template.Id = "tpl-" + Guid.NewGuid().ToString("N")[..6];
                _templates.Add(template);
            }
            _db.Save(KeyTemplates, _templates);
            var ps = $"# Сохранение ролевого шаблона онбординга «{template.Name}» -> {template.TargetOuDn}";
            RecordAudit("SaveTemplate", template.TargetOuDn, template.Name, "template", $"Сохранён шаблон роли онбординга «{template.Name}» ({template.DefaultGroups.Count} групп)", ps);
            return CommandResult<OnboardingTemplate>.Ok(existing ?? template, $"Шаблон роли «{template.Name}» сохранён", ps);
        }
    }

    public CommandResult<bool> DeleteTemplate(string templateId)
    {
        lock (_sync)
        {
            var existing = _templates.FirstOrDefault(t => t.Id == templateId);
            if (existing == null)
                return CommandResult<bool>.Fail("Шаблон не найден");

            _templates.Remove(existing);
            _db.Save(KeyTemplates, _templates);
            return CommandResult<bool>.Ok(true, $"Шаблон «{existing.Name}» удалён");
        }
    }

    public CommandResult<AdUser> ExecuteOnboarding(OnboardEmployeeRequest request)
    {
        lock (_sync)
        {
            var tpl = _templates.FirstOrDefault(t => t.Id == request.TemplateId);
            if (tpl == null)
                return CommandResult<AdUser>.Fail("Шаблон онбординга не найден");

            var createReq = new CreateUserRequest(
                SamAccountName: request.SamAccountName,
                GivenName: request.GivenName,
                Surname: request.Surname,
                DisplayName: $"{request.Surname} {request.GivenName}".Trim(),
                Title: tpl.Title,
                Department: tpl.Department,
                Company: tpl.Company,
                Office: tpl.Office,
                Email: request.Email,
                Telephone: request.Telephone,
                OuDn: tpl.TargetOuDn,
                Password: request.Password,
                Enabled: true,
                MustChangePasswordNextLogon: tpl.MustChangePassword,
                MemberOf: tpl.DefaultGroups.ToList()
            );

            return CreateUser(createReq);
        }
    }

    // ---------------------------------------------------------
    // AUDIT, ROLLBACK & RECYCLE BIN
    // ---------------------------------------------------------
    public List<AuditActionEntry> GetAuditLogs()
    {
        lock (_sync)
        {
            return _auditLogs.ToList();
        }
    }

    public CommandResult<AuditActionEntry> RollbackAction(string auditId)
    {
        lock (_sync)
        {
            var entry = _auditLogs.FirstOrDefault(a => a.Id == auditId);
            if (entry == null)
                return CommandResult<AuditActionEntry>.Fail("Запись журнала не найдена");
            if (!entry.CanRollback || string.IsNullOrEmpty(entry.RollbackPayloadJson))
                return CommandResult<AuditActionEntry>.Fail("Для этого действия нет снимка состояния (Rollback недоступен)");
            if (entry.IsRolledBack)
                return CommandResult<AuditActionEntry>.Fail("Это действие уже было откачено ранее");

            var previousUser = JsonSerializer.Deserialize<AdUser>(entry.RollbackPayloadJson);
            if (previousUser == null)
                return CommandResult<AuditActionEntry>.Fail("Не удалось десериализовать снимок состояния");

            var currentIdx = _state.Users.FindIndex(u => u.Id == previousUser.Id);
            if (currentIdx >= 0)
            {
                _state.Users[currentIdx] = previousUser;
                SyncUserGroupMemberships(previousUser);
            }
            else
            {
                _state.Users.Add(previousUser);
                SyncUserGroupMemberships(previousUser);
            }

            entry.IsRolledBack = true;
            var ps = PowerShellGenerator.ForUpdateUser(previousUser);
            RecordAudit("Rollback", previousUser.DistinguishedName, $"{previousUser.DisplayName} ({previousUser.SamAccountName})", "user", $"Откат изменения #{entry.Id}: восстановлены прежние атрибуты, OU и группы для {previousUser.DisplayName}", ps);
            PersistAll();

            return CommandResult<AuditActionEntry>.Ok(entry, $"Изменение успешно откачено: состояние «{previousUser.DisplayName}» полностью восстановлено", ps);
        }
    }

    public List<RecycleBinObject> GetRecycleBin()
    {
        lock (_sync)
        {
            return _state.RecycleBin.OrderByDescending(r => r.DeletedAt).ToList();
        }
    }

    public CommandResult<bool> RestoreRecycleBinObject(string recycleId)
    {
        lock (_sync)
        {
            var item = _state.RecycleBin.FirstOrDefault(r => r.Id == recycleId);
            if (item == null)
                return CommandResult<bool>.Fail("Объект в Корзине AD не найден");

            _state.RecycleBin.Remove(item);

            if (!string.IsNullOrEmpty(item.SerializedSnapshotJson))
            {
                var restoredUser = JsonSerializer.Deserialize<AdUser>(item.SerializedSnapshotJson);
                if (restoredUser != null)
                {
                    _state.Users.Add(restoredUser);
                    SyncUserGroupMemberships(restoredUser);
                }
            }
            else if (item.ObjectClass == "user")
            {
                var parts = item.Name.Split(' ', 2);
                _state.Users.Add(new AdUser
                {
                    Id = "usr-" + Guid.NewGuid().ToString("N")[..6],
                    SamAccountName = item.SamAccountName,
                    UserPrincipalName = $"{item.SamAccountName}@corp.satella.local",
                    DisplayName = item.Name,
                    Surname = parts[0],
                    GivenName = parts.Length > 1 ? parts[1] : item.Name,
                    Title = "Restored Employee",
                    Department = "Engineering",
                    Email = $"{item.SamAccountName}@satella.io",
                    DistinguishedName = item.OriginalDn,
                    OuDn = item.LastKnownParentDn,
                    Enabled = true
                });
            }
            else if (item.ObjectClass == "computer")
            {
                _state.Computers.Add(new AdComputer
                {
                    Id = "cmp-" + Guid.NewGuid().ToString("N")[..6],
                    Name = item.Name,
                    SamAccountName = item.SamAccountName,
                    DnsHostName = $"{item.Name.ToLowerInvariant()}.corp.satella.local",
                    DistinguishedName = item.OriginalDn,
                    OuDn = item.LastKnownParentDn,
                    IpAddress = "10.20.10.144",
                    MacAddress = "AC:1F:6B:99:04:12",
                    IsOnline = true,
                    Description = "Восстановлен из Корзины AD"
                });
            }
            else if (item.ObjectClass == "group")
            {
                _state.Groups.Add(new AdGroup
                {
                    Id = "grp-" + Guid.NewGuid().ToString("N")[..6],
                    SamAccountName = item.SamAccountName,
                    DisplayName = item.Name,
                    DistinguishedName = item.OriginalDn,
                    OuDn = item.LastKnownParentDn,
                    Description = "Группа восстановлена из Корзины AD"
                });
            }

            var ps = PowerShellGenerator.ForRestoreRecycleBinObject(item.OriginalDn, item.LastKnownParentDn);
            var audit = RecordAudit("RestoreRecycleBin", item.OriginalDn, item.Name, item.ObjectClass, $"Восстановлен объект «{item.Name}» ({item.ObjectClass}) из Корзины AD в {item.LastKnownParentDn}", ps);
            PersistAll();

            return CommandResult<bool>.Ok(true, $"Объект «{item.Name}» восстановлен из Корзины AD в {item.LastKnownParentDn}", ps, audit.Id);
        }
    }

    // ---------------------------------------------------------
    // GPO, ACL, DNS & DHCP
    // ---------------------------------------------------------
    public List<AdGpo> GetGpos()
    {
        lock (_sync)
        {
            return _state.Gpos.ToList();
        }
    }

    public CommandResult<AdGpo> SaveGpo(AdGpo gpo)
    {
        lock (_sync)
        {
            var existing = _state.Gpos.FirstOrDefault(g => g.Id == gpo.Id);
            bool isNew = existing == null;
            if (existing != null)
            {
                existing.Name = gpo.Name;
                existing.Description = gpo.Description;
                existing.Status = gpo.Status;
                existing.SecurityFiltering = gpo.SecurityFiltering ?? new List<string> { "Authenticated Users" };
                existing.WmiFilter = string.IsNullOrWhiteSpace(gpo.WmiFilter) ? "None" : gpo.WmiFilter;
                existing.KeySettingsSummary = gpo.KeySettingsSummary ?? new List<string>();
                existing.LinkedOus = gpo.LinkedOus ?? new List<GpoLink>();
                existing.ModifiedAt = DateTime.UtcNow;
            }
            else
            {
                gpo.Id = "gpo-" + Guid.NewGuid().ToString("N")[..6];
                gpo.Guid = "{" + Guid.NewGuid().ToString().ToUpperInvariant() + "}";
                gpo.CreatedAt = DateTime.UtcNow;
                gpo.ModifiedAt = DateTime.UtcNow;
                _state.Gpos.Insert(0, gpo);
            }

            var targetGpo = existing ?? gpo;
            var psLines = new List<string>
            {
                isNew
                    ? $"# Создание новой групповой политики GPO «{targetGpo.Name}»\nNew-GPO -Name \"{targetGpo.Name}\" -Comment \"{targetGpo.Description}\""
                    : $"# Обновление параметров групповой политики GPO «{targetGpo.Name}»\n(Get-GPO -Name \"{targetGpo.Name}\").Description = \"{targetGpo.Description}\""
            };
            foreach (var link in targetGpo.LinkedOus)
            {
                psLines.Add($"New-GPLink -Name \"{targetGpo.Name}\" -Target \"{link.OuDn}\" -LinkEnabled {(link.Enabled ? "Yes" : "No")} -Enforced {(link.Enforced ? "Yes" : "No")} -ErrorAction SilentlyContinue");
            }
            foreach (var setting in targetGpo.KeySettingsSummary)
            {
                psLines.Add($"# Параметр: {setting}");
            }

            var ps = string.Join(Environment.NewLine, psLines);
            var audit = RecordAudit(isNew ? "CreateGPO" : "UpdateGPO", SandboxSeeder.RootDn, targetGpo.Name, "gpo", $"{(isNew ? "Создана" : "Обновлена")} групповая политика GPO «{targetGpo.Name}» (связей OU: {targetGpo.LinkedOus.Count}, параметров: {targetGpo.KeySettingsSummary.Count})", ps);
            PersistAll();

            return CommandResult<AdGpo>.Ok(targetGpo, $"Политика GPO «{targetGpo.Name}» успешно сохранена", ps, audit.Id);
        }
    }

    public CommandResult<bool> DeleteGpo(string gpoId)
    {
        lock (_sync)
        {
            var gpo = _state.Gpos.FirstOrDefault(g => g.Id == gpoId);
            if (gpo == null)
                return CommandResult<bool>.Fail("Политика GPO не найдена");

            _state.Gpos.Remove(gpo);
            var ps = $"Remove-GPO -Name \"{gpo.Name}\" -Confirm:$false";
            var audit = RecordAudit("DeleteGPO", SandboxSeeder.RootDn, gpo.Name, "gpo", $"Удалена групповая политика GPO «{gpo.Name}» ({gpo.Guid})", ps);
            PersistAll();
            return CommandResult<bool>.Ok(true, $"Политика GPO «{gpo.Name}» удалена", ps, audit.Id);
        }
    }

    public CommandResult<AdGpo> ToggleGpoLink(string gpoId, string ouDn, bool enabled, bool enforced)
    {
        lock (_sync)
        {
            var gpo = _state.Gpos.FirstOrDefault(g => g.Id == gpoId);
            if (gpo == null)
                return CommandResult<AdGpo>.Fail("Политика GPO не найдена");

            var link = gpo.LinkedOus.FirstOrDefault(l => string.Equals(l.OuDn, ouDn, StringComparison.OrdinalIgnoreCase));
            if (link == null)
            {
                link = new GpoLink { OuDn = ouDn, Enabled = enabled, Enforced = enforced, Order = gpo.LinkedOus.Count + 1 };
                gpo.LinkedOus.Add(link);
            }
            else
            {
                link.Enabled = enabled;
                link.Enforced = enforced;
            }

            gpo.ModifiedAt = DateTime.UtcNow;
            var ps = $"Set-GPLink -Name \"{gpo.Name}\" -Target \"{ouDn}\" -LinkEnabled {(enabled ? "Yes" : "No")} -Enforced {(enforced ? "Yes" : "No")}";
            var audit = RecordAudit("UpdateGpoLink", ouDn, gpo.Name, "gpo", $"Обновлена связь GPO «{gpo.Name}» на {ouDn} (Enabled={enabled}, Enforced={enforced})", ps);
            PersistAll();
            return CommandResult<AdGpo>.Ok(gpo, $"Связь GPO «{gpo.Name}» обновлена", ps, audit.Id);
        }
    }

    public CommandResult<bool> RunGpUpdate(string targetDnOrHost)
    {
        lock (_sync)
        {
            var ps = PowerShellGenerator.ForGpUpdate(targetDnOrHost);
            var audit = RecordAudit("GpUpdate", targetDnOrHost, targetDnOrHost, "gpo", $"Запущено принудительное обновление групповых политик (gpupdate /force) для {targetDnOrHost}", ps);
            return CommandResult<bool>.Ok(true, $"Команда gpupdate /force отправлена на {targetDnOrHost}", ps, audit.Id);
        }
    }

    public List<AclRule> GetAclRules(string? targetDn = null)
    {
        lock (_sync)
        {
            if (string.IsNullOrWhiteSpace(targetDn))
                return _state.AclRules.ToList();
            return _state.AclRules.Where(a => string.Equals(a.TargetDn, targetDn, StringComparison.OrdinalIgnoreCase)).ToList();
        }
    }

    public CommandResult<AclRule> CreateAclRule(CreateAclRuleRequest request)
    {
        lock (_sync)
        {
            var rule = new AclRule
            {
                Id = "acl-" + Guid.NewGuid().ToString("N")[..6],
                TargetDn = request.TargetDn,
                IdentityReference = request.IdentityReference,
                AccessControlType = request.AccessControlType,
                ActiveDirectoryRights = request.ActiveDirectoryRights,
                InheritanceType = "All",
                IsInherited = false
            };
            _state.AclRules.Insert(0, rule);
            var ps = $"# Делегирование прав доступа ACL в AD\ndsacl.exe \"{request.TargetDn}\" /G \"{request.IdentityReference}:GA;{request.ActiveDirectoryRights}\"";
            var audit = RecordAudit("CreateAcl", request.TargetDn, request.IdentityReference, "acl", $"Добавлено правило ACL ({request.AccessControlType}: {request.ActiveDirectoryRights}) для {request.IdentityReference} на {request.TargetDn}", ps);
            PersistAll();
            return CommandResult<AclRule>.Ok(rule, $"Правило делегирования ACL для «{request.IdentityReference}» добавлено", ps, audit.Id);
        }
    }

    public List<DnsRecord> GetDnsRecords()
    {
        lock (_sync)
        {
            return _state.DnsRecords.ToList();
        }
    }

    public CommandResult<DnsRecord> CreateDnsRecord(CreateDnsRecordRequest request)
    {
        lock (_sync)
        {
            var rec = new DnsRecord
            {
                Id = "dns-" + Guid.NewGuid().ToString("N")[..6],
                ZoneName = string.IsNullOrWhiteSpace(request.ZoneName) ? "corp.satella.local" : request.ZoneName,
                Name = request.Name,
                RecordType = request.RecordType,
                Data = request.Data,
                TtlSeconds = request.TtlSeconds > 0 ? request.TtlSeconds : 3600,
                IsStatic = true,
                Timestamp = "Static"
            };
            _state.DnsRecords.Add(rec);
            var ps = $"Add-DnsServerResourceRecord{rec.RecordType} -ZoneName \"{rec.ZoneName}\" -Name \"{rec.Name}\" -IPv4Address \"{rec.Data}\" -TimeToLive ([TimeSpan]::FromSeconds({rec.TtlSeconds}))";
            var audit = RecordAudit("CreateDnsRecord", rec.ZoneName, $"{rec.Name}.{rec.ZoneName}", "dns", $"Создана DNS-запись [{rec.RecordType}] {rec.Name} -> {rec.Data}", ps);
            PersistAll();
            return CommandResult<DnsRecord>.Ok(rec, $"DNS-запись {rec.Name} ({rec.RecordType}) добавлена", ps, audit.Id);
        }
    }

    public CommandResult<bool> DeleteDnsRecord(string id)
    {
        lock (_sync)
        {
            var rec = _state.DnsRecords.FirstOrDefault(r => r.Id == id);
            if (rec == null)
                return CommandResult<bool>.Fail("DNS-запись не найдена");

            _state.DnsRecords.Remove(rec);
            var ps = $"Remove-DnsServerResourceRecord -ZoneName \"{rec.ZoneName}\" -Name \"{rec.Name}\" -RRType \"{rec.RecordType}\" -Force";
            var audit = RecordAudit("DeleteDnsRecord", rec.ZoneName, $"{rec.Name}.{rec.ZoneName}", "dns", $"Удалена DNS-запись [{rec.RecordType}] {rec.Name} ({rec.Data})", ps);
            PersistAll();
            return CommandResult<bool>.Ok(true, $"DNS-запись {rec.Name} удалена", ps, audit.Id);
        }
    }

    public List<DhcpLease> GetDhcpLeases()
    {
        lock (_sync)
        {
            return _state.DhcpLeases.ToList();
        }
    }

    public CommandResult<DhcpLease> ConvertDhcpToReservation(string leaseId)
    {
        lock (_sync)
        {
            var lease = _state.DhcpLeases.FirstOrDefault(l => l.Id == leaseId);
            if (lease == null)
                return CommandResult<DhcpLease>.Fail("Аренда DHCP не найдена");

            lease.State = "Reserved";
            lease.LeaseExpires = null;
            var scopeIp = lease.ScopeId.Split('/')[0];
            var ps = $"Add-DhcpServerv4Reservation -ScopeId {scopeIp} -IPAddress {lease.IpAddress} -ClientId \"{lease.ClientMac}\" -Name \"{lease.HostName}\" -Description \"{lease.Description}\"";
            var audit = RecordAudit("DhcpReserve", lease.ScopeId, $"{lease.IpAddress} ({lease.HostName})", "dhcp", $"Аренда IP {lease.IpAddress} ({lease.ClientMac}) закреплена как статическая резервация DHCP", ps);
            PersistAll();
            return CommandResult<DhcpLease>.Ok(lease, $"IP {lease.IpAddress} закреплён за {lease.HostName} ({lease.ClientMac})", ps, audit.Id);
        }
    }

    // ---------------------------------------------------------
    // SECURITY AUDIT SCANNER, JIT PAM, DC HEALTH & BITLOCKER
    // ---------------------------------------------------------
    public List<SecurityFinding> RunSecurityScan()
    {
        lock (_sync)
        {
            SandboxSeeder.EnsureEnterpriseModulesSeeded(_state);
            return _state.SecurityFindings.ToList();
        }
    }

    public CommandResult<SecurityFinding> FixSecurityFinding(string findingId)
    {
        lock (_sync)
        {
            var finding = _state.SecurityFindings.FirstOrDefault(f => f.Id == findingId);
            if (finding == null)
                return CommandResult<SecurityFinding>.Fail("Уязвимость не найдена");

            finding.IsFixed = true;

            switch (finding.RemediationAction)
            {
                case "FixServiceAccountSpn":
                case "DisablePasswordNeverExpires":
                    var svcUser = _state.Users.FirstOrDefault(u => string.Equals(u.SamAccountName, finding.TargetSam, StringComparison.OrdinalIgnoreCase));
                    if (svcUser != null)
                    {
                        svcUser.PasswordNeverExpires = false;
                        svcUser.PasswordExpiresAt = DateTime.UtcNow.AddDays(90);
                    }
                    break;
                case "DisableStaleComputer":
                    var comp = _state.Computers.FirstOrDefault(c => string.Equals(c.Name, finding.TargetName, StringComparison.OrdinalIgnoreCase));
                    if (comp != null)
                    {
                        comp.Enabled = false;
                        comp.IsOnline = false;
                    }
                    break;
                case "UnlockAllLockedUsers":
                    foreach (var u in _state.Users.Where(x => x.LockedOut))
                    {
                        u.LockedOut = false;
                        u.CustomAttributes["badPwdCount"] = "0";
                    }
                    break;
            }

            var audit = RecordAudit("SecurityRemediation", finding.TargetDn, finding.TargetName, finding.ObjectClass, $"Устранена уязвимость ИБ [{finding.Severity} / {finding.Category}]: {finding.Title}", finding.PowerShellFix);
            PersistAll();
            return CommandResult<SecurityFinding>.Ok(finding, $"Уязвимость «{finding.Title}» устранена", finding.PowerShellFix, audit.Id);
        }
    }

    public List<JitAccessGrant> GetJitGrants()
    {
        lock (_sync)
        {
            SandboxSeeder.EnsureEnterpriseModulesSeeded(_state);
            var now = DateTime.UtcNow;
            foreach (var g in _state.JitGrants.Where(x => x.IsActive && x.ExpiresAt <= now))
            {
                g.IsActive = false;
            }
            return _state.JitGrants.OrderByDescending(g => g.IsActive).ThenByDescending(g => g.GrantedAt).ToList();
        }
    }

    public CommandResult<JitAccessGrant> CreateJitGrant(CreateJitGrantRequest request)
    {
        lock (_sync)
        {
            var user = _state.Users.FirstOrDefault(u => u.Id == request.UserId || string.Equals(u.SamAccountName, request.UserId, StringComparison.OrdinalIgnoreCase));
            var grp = _state.Groups.FirstOrDefault(g => g.Id == request.GroupId || string.Equals(g.SamAccountName, request.GroupId, StringComparison.OrdinalIgnoreCase));
            if (user == null || grp == null)
                return CommandResult<JitAccessGrant>.Fail("Пользователь или группа не найдены");

            var mins = request.DurationMinutes > 0 ? request.DurationMinutes : 60;
            var grant = new JitAccessGrant
            {
                Id = "jit-" + Guid.NewGuid().ToString("N")[..6],
                UserId = user.Id,
                UserSam = user.SamAccountName,
                UserDisplayName = user.DisplayName,
                GroupId = grp.Id,
                GroupName = grp.SamAccountName,
                GroupDn = grp.DistinguishedName,
                GrantedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddMinutes(mins),
                DurationMinutes = mins,
                Reason = string.IsNullOrWhiteSpace(request.Reason) ? "Плановые работы по заявке PAM/JIT" : request.Reason,
                GrantedBy = GetActiveProfile().Username,
                IsActive = true
            };

            if (!user.MemberOf.Contains(grp.DistinguishedName, StringComparer.OrdinalIgnoreCase))
            {
                user.MemberOf.Add(grp.DistinguishedName);
                SyncUserGroupMemberships(user);
            }

            _state.JitGrants.Insert(0, grant);

            var ps = $"# Выдача временного JIT/PAM доступа в группу «{grp.SamAccountName}» на {mins} мин. (AD PAM Time-To-Live)\n$ttl = New-TimeSpan -Minutes {mins}\nAdd-ADGroupMember -Identity \"{grp.SamAccountName}\" -Members \"{user.SamAccountName}\" -MemberTimeToLive $ttl";
            var audit = RecordAudit("GrantJitAccess", grp.DistinguishedName, $"{user.DisplayName} -> {grp.SamAccountName}", "jit", $"Выдан временный доступ JIT/PAM пользователю {user.DisplayName} в группу {grp.SamAccountName} на {mins} мин. Причина: {grant.Reason}", ps);
            PersistAll();

            return CommandResult<JitAccessGrant>.Ok(grant, $"Временный доступ в «{grp.SamAccountName}» выдан для {user.DisplayName} на {mins} мин.", ps, audit.Id);
        }
    }

    public CommandResult<bool> RevokeJitGrant(string grantId)
    {
        lock (_sync)
        {
            var grant = _state.JitGrants.FirstOrDefault(g => g.Id == grantId);
            if (grant == null)
                return CommandResult<bool>.Fail("Временный доступ не найден");

            grant.IsActive = false;
            grant.ExpiresAt = DateTime.UtcNow;

            var user = _state.Users.FirstOrDefault(u => u.Id == grant.UserId);
            if (user != null)
            {
                user.MemberOf.RemoveAll(m => string.Equals(m, grant.GroupDn, StringComparison.OrdinalIgnoreCase));
                SyncUserGroupMemberships(user);
            }

            var ps = $"# Досрочный отзыв временного JIT/PAM доступа\nRemove-ADGroupMember -Identity \"{grant.GroupName}\" -Members \"{grant.UserSam}\" -Confirm:$false";
            var audit = RecordAudit("RevokeJitAccess", grant.GroupDn, $"{grant.UserDisplayName} -> {grant.GroupName}", "jit", $"Досрочно отозван временный доступ JIT/PAM у {grant.UserDisplayName} из группы {grant.GroupName}", ps);
            PersistAll();

            return CommandResult<bool>.Ok(true, $"Временный доступ {grant.UserDisplayName} в «{grant.GroupName}» отозван", ps, audit.Id);
        }
    }

    public List<DomainControllerStatus> GetDomainControllers()
    {
        lock (_sync)
        {
            SandboxSeeder.EnsureEnterpriseModulesSeeded(_state);
            return _state.DomainControllers.ToList();
        }
    }

    public CommandResult<List<DomainControllerStatus>> TransferFsmoRole(TransferFsmoRequest request)
    {
        lock (_sync)
        {
            SandboxSeeder.EnsureEnterpriseModulesSeeded(_state);
            var targetDc = _state.DomainControllers.FirstOrDefault(d => string.Equals(d.Name, request.TargetDcName, StringComparison.OrdinalIgnoreCase));
            if (targetDc == null)
                return CommandResult<List<DomainControllerStatus>>.Fail("Целевой контроллер домена не найден");

            foreach (var dc in _state.DomainControllers)
            {
                dc.FsmoRoles.RemoveAll(r => string.Equals(r, request.RoleName, StringComparison.OrdinalIgnoreCase));
            }
            targetDc.FsmoRoles.Add(request.RoleName);

            var ps = $"Move-ADDirectoryServerOperationMasterRole -Identity \"{targetDc.Name}\" -OperationMasterRole {request.RoleName} -Confirm:$false";
            var audit = RecordAudit("TransferFSMO", targetDc.Fqdn, $"{request.RoleName} -> {targetDc.Name}", "domainController", $"Роль FSMO «{request.RoleName}» передана на контроллер домена {targetDc.Name} ({targetDc.IpAddress})", ps);
            PersistAll();

            return CommandResult<List<DomainControllerStatus>>.Ok(_state.DomainControllers.ToList(), $"Роль FSMO «{request.RoleName}» успешно передана на {targetDc.Name}", ps, audit.Id);
        }
    }

    public CommandResult<List<DomainControllerStatus>> ForceDcReplication()
    {
        lock (_sync)
        {
            SandboxSeeder.EnsureEnterpriseModulesSeeded(_state);
            foreach (var dc in _state.DomainControllers)
            {
                dc.LastReplicationAt = DateTime.UtcNow;
                dc.ReplicationDeltaSeconds = 0;
                dc.ReplicationStatus = "Healthy (0 errors, synced just now)";
            }

            var ps = "# Форсированная репликация всех разделов каталога AD между контроллерами домена\nrepadmin /syncall /AdeP\nrepadmin /replsummary";
            var audit = RecordAudit("ForceReplication", SandboxSeeder.RootDn, "All Domain Controllers", "domainController", "Выполнена принудительная синхронизация репликации Active Directory (repadmin /syncall /AdeP)", ps);
            PersistAll();

            return CommandResult<List<DomainControllerStatus>>.Ok(_state.DomainControllers.ToList(), "Репликация контроллеров домена успешно синхронизирована (0 ошибок)", ps, audit.Id);
        }
    }

    public List<(AdComputer Computer, BitLockerRecoveryKey Key)> GetBitLockerKeys(string? search = null)
    {
        lock (_sync)
        {
            SandboxSeeder.EnsureEnterpriseModulesSeeded(_state);
            var list = new List<(AdComputer Computer, BitLockerRecoveryKey Key)>();
            foreach (var comp in _state.Computers)
            {
                if (comp.BitLockerKeys == null || comp.BitLockerKeys.Count == 0)
                {
                    var idx = Math.Abs(comp.Name.GetHashCode()) % 899999 + 100000;
                    comp.BitLockerKeys = new List<BitLockerRecoveryKey>
                    {
                        new()
                        {
                            KeyId = $"{idx:X8}"[..Math.Min(8, $"{idx:X8}".Length)].PadRight(8, 'A'),
                            RecoveryPassword = $"{idx}-482910-738291-550192-384710-918273-647382-192837",
                            VolumeType = "Operating System Drive (C:)",
                            CipherStrength = "XTS-AES 256-bit",
                            CreatedAt = DateTime.UtcNow.AddDays(-20)
                        }
                    };
                }

                foreach (var k in comp.BitLockerKeys)
                {
                    if (string.IsNullOrWhiteSpace(search) ||
                        comp.Name.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                        k.KeyId.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                        k.RecoveryPassword.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                        comp.LoggedOnUser.Contains(search, StringComparison.OrdinalIgnoreCase))
                    {
                        list.Add((comp, k));
                    }
                }
            }
            return list;
        }
    }
}

