using System.DirectoryServices;
using System.DirectoryServices.ActiveDirectory;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Satella.Core.Interfaces;
using Satella.Core.Models;
using Satella.Infrastructure.Storage;

namespace Satella.Infrastructure.Providers;

public static class RealActiveDirectoryConnector
{
    private static string GetTargetServer(DomainProfile profile)
    {
        var host = !string.IsNullOrWhiteSpace(profile.DcHost) ? profile.DcHost.Trim() : profile.DomainName.Trim();
        if (profile.Port > 0 && profile.Port != 389 && !host.Contains(':'))
            return $"{host}:{profile.Port}";
        return host;
    }

    private static DirectoryEntry Bind(DomainProfile profile, string pathSuffix, string? overridePlainPassword = null)
    {
        var server = GetTargetServer(profile);
        var fullPath = string.IsNullOrWhiteSpace(pathSuffix)
            ? $"LDAP://{server}"
            : $"LDAP://{server}/{pathSuffix}";

        var authType = AuthenticationTypes.Secure;
        if (profile.UseSsl || profile.Port == 636)
            authType |= AuthenticationTypes.Encryption;

        if (profile.UseCurrentUserSso)
        {
            return new DirectoryEntry(fullPath, null, null, authType);
        }

        var password = overridePlainPassword ?? CredentialProtector.Decrypt(profile.EncryptedPassword);
        return new DirectoryEntry(fullPath, profile.Username, password, authType);
    }

    public static DomainProfile DetectCurrentWindowsDomain()
    {
        try
        {
            using var domain = Domain.GetCurrentDomain();
            var dc = domain.FindDomainController();
            return new DomainProfile
            {
                Name = $"Домен Windows ({domain.Name})",
                DomainName = domain.Name,
                DcHost = dc.IPAddress ?? dc.Name,
                Port = 389,
                UseSsl = false,
                UseCurrentUserSso = true,
                Username = $"{Environment.UserDomainName}\\{Environment.UserName}",
                IsSandbox = false
            };
        }
        catch
        {
            var ipProps = IPGlobalProperties.GetIPGlobalProperties();
            var dnsDomain = !string.IsNullOrWhiteSpace(ipProps.DomainName)
                ? ipProps.DomainName
                : $"{Environment.UserDomainName.ToLowerInvariant()}.local";

            return new DomainProfile
            {
                Name = $"Контроллер AD ({dnsDomain})",
                DomainName = dnsDomain,
                DcHost = dnsDomain,
                Port = 389,
                UseSsl = false,
                UseCurrentUserSso = true,
                Username = $"{Environment.UserDomainName}\\{Environment.UserName}",
                IsSandbox = false
            };
        }
    }

    public static CommandResult<string> TestConnection(DomainProfile profile, string? plainPassword)
    {
        try
        {
            using var rootDse = Bind(profile, "RootDSE", plainPassword);
            var defaultNamingContext = rootDse.Properties["defaultNamingContext"]?.Value?.ToString();
            var dnsHostName = rootDse.Properties["dnsHostName"]?.Value?.ToString() ?? profile.DcHost;

            if (string.IsNullOrWhiteSpace(defaultNamingContext))
                return CommandResult<string>.Fail("Не удалось прочитать defaultNamingContext из RootDSE контроллера домена.");

            using var rootEntry = Bind(profile, defaultNamingContext, plainPassword);
            using var searcher = new DirectorySearcher(rootEntry)
            {
                Filter = "(objectCategory=person)",
                PageSize = 500
            };
            searcher.PropertiesToLoad.Add("distinguishedName");
            var userCount = searcher.FindAll().Count;

            return CommandResult<string>.Ok(
                defaultNamingContext,
                $"Успешное подключение к контроллеру {dnsHostName}! Корень AD: {defaultNamingContext} (Найдено пользователей: {userCount})",
                $"Get-ADDomainController -Server \"{profile.DcHost}\""
            );
        }
        catch (Exception ex)
        {
            return CommandResult<string>.Fail($"Ошибка подключения LDAP к {profile.DcHost}:{profile.Port} — {ex.Message}");
        }
    }

    public static SandboxStateDocument LoadFromRealAd(DomainProfile profile, out string rootDn)
    {
        using var rootDse = Bind(profile, "RootDSE");
        rootDn = rootDse.Properties["defaultNamingContext"]?.Value?.ToString()
                 ?? ConvertDomainToDn(profile.DomainName);

        var state = new SandboxStateDocument();
        using var rootEntry = Bind(profile, rootDn);

        // 1. Root Node + OUs + Builtin Containers (CN=Users, CN=Computers)
        state.FlatOus.Add(new OuNode
        {
            Id = "ou-root",
            Name = profile.DomainName,
            DistinguishedName = rootDn,
            ParentDn = "",
            Description = $"Корневой домен Active Directory ({profile.DcHost})"
        });

        using (var ouSearcher = new DirectorySearcher(rootEntry)
        {
            Filter = "(|(objectClass=organizationalUnit)(&(objectClass=container)(|(cn=Users)(cn=Computers))))",
            PageSize = 1000
        })
        {
            ouSearcher.PropertiesToLoad.AddRange(new[] { "ou", "cn", "name", "distinguishedName", "description", "gPLink" });
            foreach (SearchResult res in ouSearcher.FindAll())
            {
                var dn = GetProp(res, "distinguishedName");
                if (string.IsNullOrEmpty(dn) || string.Equals(dn, rootDn, StringComparison.OrdinalIgnoreCase))
                    continue;

                var name = GetProp(res, "ou");
                if (string.IsNullOrEmpty(name))
                    name = GetProp(res, "name");
                if (string.IsNullOrEmpty(name))
                    name = GetProp(res, "cn");

                var parentDn = GetParentDn(dn);
                state.FlatOus.Add(new OuNode
                {
                    Id = "ou-" + Math.Abs(dn.GetHashCode()),
                    Name = name,
                    DistinguishedName = dn,
                    ParentDn = parentDn,
                    Description = GetProp(res, "description")
                });
            }
        }

        // 2. Users
        using (var userSearcher = new DirectorySearcher(rootEntry)
        {
            Filter = "(&(objectCategory=person)(objectClass=user))",
            PageSize = 1000
        })
        {
            userSearcher.PropertiesToLoad.AddRange(new[]
            {
                "sAMAccountName", "userPrincipalName", "displayName", "givenName", "sn",
                "title", "department", "company", "mail", "telephoneNumber", "mobile",
                "physicalDeliveryOfficeName", "distinguishedName", "userAccountControl",
                "lockoutTime", "whenCreated", "description", "memberOf", "badPwdCount",
                "homeDirectory", "employeeID"
            });

            foreach (SearchResult res in userSearcher.FindAll())
            {
                var dn = GetProp(res, "distinguishedName");
                var sam = GetProp(res, "sAMAccountName");
                if (string.IsNullOrEmpty(dn) || string.IsNullOrEmpty(sam))
                    continue;

                var uacStr = GetProp(res, "userAccountControl");
                int uac = int.TryParse(uacStr, out var parsedUac) ? parsedUac : 512;
                bool enabled = (uac & 0x0002) == 0;
                bool pwdNeverExpires = (uac & 0x10000) != 0;

                var lockoutStr = GetProp(res, "lockoutTime");
                bool lockedOut = long.TryParse(lockoutStr, out var lockTicks) && lockTicks > 0;

                var given = GetProp(res, "givenName");
                var sn = GetProp(res, "sn");
                var display = GetProp(res, "displayName");
                if (string.IsNullOrWhiteSpace(display))
                    display = !string.IsNullOrWhiteSpace($"{sn} {given}".Trim()) ? $"{sn} {given}".Trim() : sam;

                var memberOf = new List<string>();
                if (res.Properties.Contains("memberOf"))
                {
                    foreach (var m in res.Properties["memberOf"])
                    {
                        if (m != null) memberOf.Add(m.ToString()!);
                    }
                }

                state.Users.Add(new AdUser
                {
                    Id = "usr-" + Math.Abs(dn.GetHashCode()),
                    SamAccountName = sam,
                    UserPrincipalName = GetProp(res, "userPrincipalName", $"{sam}@{profile.DomainName}"),
                    DisplayName = display,
                    GivenName = given,
                    Surname = sn,
                    Title = GetProp(res, "title"),
                    Department = GetProp(res, "department"),
                    Company = GetProp(res, "company", profile.DomainName),
                    Office = GetProp(res, "physicalDeliveryOfficeName"),
                    Email = GetProp(res, "mail"),
                    Telephone = GetProp(res, "telephoneNumber"),
                    Mobile = GetProp(res, "mobile"),
                    DistinguishedName = dn,
                    OuDn = GetParentDn(dn),
                    Enabled = enabled,
                    LockedOut = lockedOut,
                    PasswordNeverExpires = pwdNeverExpires,
                    Description = GetProp(res, "description"),
                    MemberOf = memberOf,
                    CustomAttributes = new Dictionary<string, string>
                    {
                        ["userAccountControl"] = uac.ToString(),
                        ["badPwdCount"] = GetProp(res, "badPwdCount", "0"),
                        ["homeDirectory"] = GetProp(res, "homeDirectory"),
                        ["employeeID"] = GetProp(res, "employeeID")
                    }
                });
            }
        }

        // 3. Groups
        using (var groupSearcher = new DirectorySearcher(rootEntry)
        {
            Filter = "(objectCategory=group)",
            PageSize = 1000
        })
        {
            groupSearcher.PropertiesToLoad.AddRange(new[]
            {
                "sAMAccountName", "displayName", "cn", "distinguishedName",
                "description", "mail", "groupType", "member"
            });

            foreach (SearchResult res in groupSearcher.FindAll())
            {
                var dn = GetProp(res, "distinguishedName");
                var sam = GetProp(res, "sAMAccountName");
                if (string.IsNullOrEmpty(dn) || string.IsNullOrEmpty(sam))
                    continue;

                int gType = int.TryParse(GetProp(res, "groupType"), out var gt) ? gt : -2147483646;
                string category = (gType & unchecked((int)0x80000000)) != 0 ? "Security" : "Distribution";
                string scope = (gType & 0x00000004) != 0
                    ? "DomainLocal"
                    : (gType & 0x00000008) != 0
                        ? "Universal"
                        : "Global";

                var members = new List<string>();
                if (res.Properties.Contains("member"))
                {
                    foreach (var m in res.Properties["member"])
                    {
                        if (m != null) members.Add(m.ToString()!);
                    }
                }

                var display = GetProp(res, "displayName");
                if (string.IsNullOrWhiteSpace(display))
                    display = GetProp(res, "cn", sam);

                state.Groups.Add(new AdGroup
                {
                    Id = "grp-" + Math.Abs(dn.GetHashCode()),
                    SamAccountName = sam,
                    DisplayName = display,
                    DistinguishedName = dn,
                    OuDn = GetParentDn(dn),
                    GroupCategory = category,
                    GroupScope = scope,
                    Description = GetProp(res, "description"),
                    Email = GetProp(res, "mail"),
                    Members = members
                });
            }
        }

        // 4. Computers
        using (var compSearcher = new DirectorySearcher(rootEntry)
        {
            Filter = "(objectCategory=computer)",
            PageSize = 1000
        })
        {
            compSearcher.PropertiesToLoad.AddRange(new[]
            {
                "cn", "name", "sAMAccountName", "dNSHostName", "distinguishedName",
                "operatingSystem", "operatingSystemVersion", "description",
                "userAccountControl", "ms-Mcs-AdmPwd", "ms-Mcs-AdmPwdExpirationTime",
                "msLAPS-Password", "msLAPS-PasswordExpirationTime"
            });

            foreach (SearchResult res in compSearcher.FindAll())
            {
                var dn = GetProp(res, "distinguishedName");
                var name = GetProp(res, "cn", GetProp(res, "name"));
                if (string.IsNullOrEmpty(dn) || string.IsNullOrEmpty(name))
                    continue;

                var dnsHost = GetProp(res, "dNSHostName", $"{name.ToLowerInvariant()}.{profile.DomainName}");
                var ip = TryResolveIp(dnsHost);
                var lapsPwd = GetProp(res, "msLAPS-Password");
                if (string.IsNullOrWhiteSpace(lapsPwd))
                    lapsPwd = GetProp(res, "ms-Mcs-AdmPwd", "LAPS не настроен (Нет атрибута)");

                DateTime? lapsExp = DateTime.UtcNow.AddDays(14);
                var expStr = GetProp(res, "msLAPS-PasswordExpirationTime", GetProp(res, "ms-Mcs-AdmPwdExpirationTime"));
                if (long.TryParse(expStr, out var fileTime) && fileTime > 0)
                {
                    try { lapsExp = DateTime.FromFileTimeUtc(fileTime); } catch { }
                }

                state.Computers.Add(new AdComputer
                {
                    Id = "cmp-" + Math.Abs(dn.GetHashCode()),
                    Name = name,
                    SamAccountName = GetProp(res, "sAMAccountName", $"{name}$"),
                    DnsHostName = dnsHost,
                    DistinguishedName = dn,
                    OuDn = GetParentDn(dn),
                    OperatingSystem = GetProp(res, "operatingSystem", "Windows Workstation / Server"),
                    OsVersion = GetProp(res, "operatingSystemVersion", "10.0"),
                    IpAddress = ip,
                    MacAddress = "00:15:5D:AD:01:01",
                    Enabled = true,
                    IsOnline = !string.IsNullOrEmpty(ip),
                    PingLatencyMs = 1,
                    Uptime = "Online",
                    Description = GetProp(res, "description"),
                    LapsPassword = lapsPwd,
                    LapsExpiration = lapsExp
                });
            }
        }

        // 5. GPOs
        using (var gpoSearcher = new DirectorySearcher(rootEntry)
        {
            Filter = "(objectCategory=groupPolicyContainer)",
            PageSize = 500
        })
        {
            gpoSearcher.PropertiesToLoad.AddRange(new[] { "displayName", "cn", "distinguishedName", "gPCFileSysPath" });
            foreach (SearchResult res in gpoSearcher.FindAll())
            {
                var guid = GetProp(res, "cn");
                var name = GetProp(res, "displayName", guid);
                if (string.IsNullOrEmpty(name)) continue;

                state.Gpos.Add(new AdGpo
                {
                    Id = "gpo-" + Math.Abs(guid.GetHashCode()),
                    Name = name,
                    Guid = guid,
                    Status = "AllSettingsEnabled",
                    Description = GetProp(res, "gPCFileSysPath"),
                    LinkedOus = new List<GpoLink>
                    {
                        new() { OuDn = rootDn, Enabled = true, Enforced = false, Order = 1 }
                    },
                    KeySettingsSummary = new List<string> { $"SysVol Path: {GetProp(res, "gPCFileSysPath")}" }
                });
            }
        }

        return state;
    }

    // ---------------------------------------------------------
    // REAL AD MUTATION HELPERS
    // ---------------------------------------------------------
    public static void UnlockUserInAd(DomainProfile profile, string userDn)
    {
        using var entry = Bind(profile, userDn);
        entry.Properties["lockoutTime"].Value = 0;
        entry.CommitChanges();
    }

    public static void SetUserEnabledInAd(DomainProfile profile, string userDn, bool enabled)
    {
        using var entry = Bind(profile, userDn);
        int uac = entry.Properties["userAccountControl"].Value is int v ? v : 512;
        if (enabled)
            uac &= ~0x0002;
        else
            uac |= 0x0002;
        entry.Properties["userAccountControl"].Value = uac;
        entry.CommitChanges();
    }

    public static void ResetPasswordInAd(DomainProfile profile, string userDn, string newPassword, bool mustChange, bool unlock)
    {
        using var entry = Bind(profile, userDn);
        entry.Invoke("SetPassword", new object[] { newPassword });
        entry.Properties["pwdLastSet"].Value = mustChange ? 0 : -1;
        if (unlock)
            entry.Properties["lockoutTime"].Value = 0;
        entry.CommitChanges();
    }

    public static void UpdateUserInAd(DomainProfile profile, AdUser user)
    {
        using var entry = Bind(profile, user.DistinguishedName);
        SetOrClearProp(entry, "displayName", user.DisplayName);
        SetOrClearProp(entry, "givenName", user.GivenName);
        SetOrClearProp(entry, "sn", user.Surname);
        SetOrClearProp(entry, "title", user.Title);
        SetOrClearProp(entry, "department", user.Department);
        SetOrClearProp(entry, "company", user.Company);
        SetOrClearProp(entry, "physicalDeliveryOfficeName", user.Office);
        SetOrClearProp(entry, "mail", user.Email);
        SetOrClearProp(entry, "telephoneNumber", user.Telephone);
        SetOrClearProp(entry, "description", user.Description);
        entry.CommitChanges();
    }

    public static void CreateUserInAd(DomainProfile profile, AdUser user, string password)
    {
        using var ouEntry = Bind(profile, user.OuDn);
        using var newUser = ouEntry.Children.Add($"CN={EscapeDnComponent(user.DisplayName)}", "user");
        newUser.Properties["sAMAccountName"].Value = user.SamAccountName;
        newUser.Properties["userPrincipalName"].Value = user.UserPrincipalName;
        SetOrClearProp(newUser, "displayName", user.DisplayName);
        SetOrClearProp(newUser, "givenName", user.GivenName);
        SetOrClearProp(newUser, "sn", user.Surname);
        SetOrClearProp(newUser, "title", user.Title);
        SetOrClearProp(newUser, "department", user.Department);
        SetOrClearProp(newUser, "mail", user.Email);
        SetOrClearProp(newUser, "telephoneNumber", user.Telephone);
        newUser.CommitChanges();

        if (!string.IsNullOrEmpty(password))
        {
            newUser.Invoke("SetPassword", new object[] { password });
        }
        int uac = user.Enabled ? 512 : 514;
        newUser.Properties["userAccountControl"].Value = uac;
        if (user.MustChangePasswordNextLogon)
            newUser.Properties["pwdLastSet"].Value = 0;
        newUser.CommitChanges();
    }

    public static void MoveObjectInAd(DomainProfile profile, string objectDn, string targetOuDn)
    {
        using var objEntry = Bind(profile, objectDn);
        using var targetEntry = Bind(profile, targetOuDn);
        objEntry.MoveTo(targetEntry);
    }

    public static void CreateOuInAd(DomainProfile profile, CreateOuRequest request)
    {
        using var parentEntry = Bind(profile, request.ParentDn);
        using var newOu = parentEntry.Children.Add($"OU={EscapeDnComponent(request.Name)}", "organizationalUnit");
        if (!string.IsNullOrWhiteSpace(request.Description))
            newOu.Properties["description"].Value = request.Description;
        newOu.CommitChanges();
    }

    public static void CreateGroupInAd(DomainProfile profile, AdGroup group)
    {
        using var ouEntry = Bind(profile, group.OuDn);
        using var newGrp = ouEntry.Children.Add($"CN={EscapeDnComponent(group.SamAccountName)}", "group");
        newGrp.Properties["sAMAccountName"].Value = group.SamAccountName;
        if (!string.IsNullOrWhiteSpace(group.Description))
            newGrp.Properties["description"].Value = group.Description;
        newGrp.CommitChanges();
    }

    public static void ExpireLapsPasswordInAd(DomainProfile profile, string computerDn)
    {
        using var compEntry = Bind(profile, computerDn);
        if (compEntry.Properties.Contains("msLAPS-PasswordExpirationTime"))
            compEntry.Properties["msLAPS-PasswordExpirationTime"].Value = "0";
        if (compEntry.Properties.Contains("ms-Mcs-AdmPwdExpirationTime"))
            compEntry.Properties["ms-Mcs-AdmPwdExpirationTime"].Value = "0";
        compEntry.CommitChanges();
    }

    private static void SetOrClearProp(DirectoryEntry entry, string propName, string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            if (entry.Properties.Contains(propName))
                entry.Properties[propName].Clear();
        }
        else
        {
            entry.Properties[propName].Value = value;
        }
    }

    private static string GetProp(SearchResult res, string propName, string defaultValue = "")
    {
        if (res.Properties.Contains(propName) && res.Properties[propName].Count > 0)
            return res.Properties[propName][0]?.ToString() ?? defaultValue;
        return defaultValue;
    }

    private static string GetParentDn(string dn)
    {
        var idx = dn.IndexOf(',');
        return idx > 0 && idx < dn.Length - 1 ? dn[(idx + 1)..] : "";
    }

    private static string ConvertDomainToDn(string domainName)
    {
        if (string.IsNullOrWhiteSpace(domainName))
            return SandboxSeeder.RootDn;
        return string.Join(",", domainName.Split('.', StringSplitOptions.RemoveEmptyEntries).Select(p => $"DC={p}"));
    }

    private static string EscapeDnComponent(string input) =>
        (input ?? string.Empty).Replace(",", "\\,");

    private static string TryResolveIp(string hostName)
    {
        try
        {
            var addresses = Dns.GetHostAddresses(hostName);
            var ipv4 = addresses.FirstOrDefault(a => a.AddressFamily == AddressFamily.InterNetwork);
            return ipv4?.ToString() ?? "";
        }
        catch
        {
            return "";
        }
    }
}

