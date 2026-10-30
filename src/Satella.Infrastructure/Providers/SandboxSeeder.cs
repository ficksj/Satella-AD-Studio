using Satella.Core.Models;
using Satella.Infrastructure.Storage;

namespace Satella.Infrastructure.Providers;

public static class SandboxSeeder
{
    public const string RootDn = "DC=corp,DC=satella,DC=local";

    public static SandboxStateDocument CreateInitialState()
    {
        var state = new SandboxStateDocument();

        // 1. OUs
        state.FlatOus = new List<OuNode>
        {
            new() { Id = "ou-root", Name = "corp.satella.local", DistinguishedName = RootDn, ParentDn = "", Description = "Корневой домен леса Satella Enterprise" },
            new() { Id = "ou-hq", Name = "HQ Moscow", DistinguishedName = $"OU=HQ Moscow,{RootDn}", ParentDn = RootDn, Description = "Головной офис (Москва)" },
            new() { Id = "ou-eng", Name = "Engineering", DistinguishedName = $"OU=Engineering,OU=HQ Moscow,{RootDn}", ParentDn = $"OU=HQ Moscow,{RootDn}", Description = "Департамент разработки и инфраструктуры", LinkedGpoIds = new() { "gpo-1", "gpo-5" } },
            new() { Id = "ou-sec", Name = "Security & SOC", DistinguishedName = $"OU=Security & SOC,OU=HQ Moscow,{RootDn}", ParentDn = $"OU=HQ Moscow,{RootDn}", Description = "Информационная безопасность и мониторинг", LinkedGpoIds = new() { "gpo-1", "gpo-2" } },
            new() { Id = "ou-fin", Name = "Finance & Legal", DistinguishedName = $"OU=Finance & Legal,OU=HQ Moscow,{RootDn}", ParentDn = $"OU=HQ Moscow,{RootDn}", Description = "Бухгалтерия, казначейство и юристы", LinkedGpoIds = new() { "gpo-1", "gpo-3" } },
            new() { Id = "ou-hr", Name = "HR & Operations", DistinguishedName = $"OU=HR & Operations,OU=HQ Moscow,{RootDn}", ParentDn = $"OU=HQ Moscow,{RootDn}", Description = "Отдел кадров и административный отдел", LinkedGpoIds = new() { "gpo-1" } },
            new() { Id = "ou-exec", Name = "Executive", DistinguishedName = $"OU=Executive,OU=HQ Moscow,{RootDn}", ParentDn = $"OU=HQ Moscow,{RootDn}", Description = "Руководство компании (C-Level)" },
            new() { Id = "ou-spb", Name = "Branch SPb", DistinguishedName = $"OU=Branch SPb,{RootDn}", ParentDn = RootDn, Description = "Филиал Санкт-Петербург" },
            new() { Id = "ou-ws", Name = "Workstations", DistinguishedName = $"OU=Workstations,{RootDn}", ParentDn = RootDn, Description = "Рабочие станции сотрудников", LinkedGpoIds = new() { "gpo-2", "gpo-4", "gpo-6" } },
            new() { Id = "ou-ws-eng", Name = "Engineering PCs", DistinguishedName = $"OU=Engineering PCs,OU=Workstations,{RootDn}", ParentDn = $"OU=Workstations,{RootDn}", Description = "ПК разработчиков и DevOps" },
            new() { Id = "ou-ws-fin", Name = "Finance PCs", DistinguishedName = $"OU=Finance PCs,OU=Workstations,{RootDn}", ParentDn = $"OU=Workstations,{RootDn}", Description = "Защищённые ПК финансового блока", LinkedGpoIds = new() { "gpo-3" } },
            new() { Id = "ou-srv", Name = "Servers", DistinguishedName = $"OU=Servers,{RootDn}", ParentDn = RootDn, Description = "Серверная инфраструктура ЦОД", LinkedGpoIds = new() { "gpo-1", "gpo-4" } },
            new() { Id = "ou-dc", Name = "Domain Controllers", DistinguishedName = $"OU=Domain Controllers,OU=Servers,{RootDn}", ParentDn = $"OU=Servers,{RootDn}", Description = "Контроллеры домена Active Directory" },
            new() { Id = "ou-groups", Name = "Security Groups", DistinguishedName = $"OU=Security Groups,{RootDn}", ParentDn = RootDn, Description = "Группы безопасности и доступов RBAC" },
            new() { Id = "ou-svc", Name = "Service Accounts", DistinguishedName = $"OU=Service Accounts,{RootDn}", ParentDn = RootDn, Description = "Сервисные учётные записи (gMSA / SVC)" },
            new() { Id = "ou-disabled", Name = "Disabled Users", DistinguishedName = $"OU=Disabled Users,{RootDn}", ParentDn = RootDn, Description = "Архив уволенных и отключённых учётных записей" },
        };

        var grpOu = $"OU=Security Groups,{RootDn}";
        string GrpDn(string name) => $"CN={name},{grpOu}";

        // 2. Users
        var rawUsers = new (string sam, string given, string sur, string title, string dept, string ou, bool enabled, bool locked, int pwdDaysLeft, string phone, string[] groups)[]
        {
            ("a.volkov", "Александр", "Волков", "Principal Systems Architect", "Engineering", $"OU=Engineering,OU=HQ Moscow,{RootDn}", true, false, 42, "+7 (495) 700-10-01", new[] { "Domain Admins", "VPN-Users", "Kubernetes-Admins", "GitLab-Developers" }),
            ("m.sokolova", "Мария", "Соколова", "Chief Accountant (Главбух)", "Finance & Legal", $"OU=Finance & Legal,OU=HQ Moscow,{RootDn}", true, true, 12, "+7 (495) 700-20-01", new[] { "1C-Enterprise-Finance", "VPN-Users", "EDR-Protected-Users" }),
            ("d.morozov", "Дмитрий", "Морозов", "Senior Backend Developer", "Engineering", $"OU=Engineering,OU=HQ Moscow,{RootDn}", true, false, 3, "+7 (495) 700-10-14", new[] { "GitLab-Developers", "VPN-Users", "Kubernetes-Admins" }),
            ("e.lebedeva", "Елена", "Лебедева", "HR Director", "HR & Operations", $"OU=HR & Operations,OU=HQ Moscow,{RootDn}", true, false, 2, "+7 (495) 700-30-01", new[] { "HR-Portal-Managers", "VPN-Users", "WiFi-Corp-Access" }),
            ("i.petrov", "Игорь", "Петров", "Lead SOC Analyst", "Security & SOC", $"OU=Security & SOC,OU=HQ Moscow,{RootDn}", true, false, 65, "+7 (495) 700-99-01", new[] { "SOC-Analysts", "Helpdesk-Operators", "VPN-Users" }),
            ("k.smirnov", "Кирилл", "Смирнов", "DevOps Engineer", "Engineering", $"OU=Engineering,OU=HQ Moscow,{RootDn}", true, true, 19, "+7 (495) 700-10-22", new[] { "Kubernetes-Admins", "GitLab-Developers", "VPN-Users" }),
            ("o.novikova", "Ольга", "Новикова", "Financial Controller", "Finance & Legal", $"OU=Finance & Legal,OU=HQ Moscow,{RootDn}", true, false, 5, "+7 (495) 700-20-08", new[] { "1C-Enterprise-Finance", "WiFi-Corp-Access" }),
            ("n.kozlov", "Никита", "Козлов", "Frontend Tech Lead", "Engineering", $"OU=Engineering,OU=HQ Moscow,{RootDn}", true, false, 51, "+7 (495) 700-10-33", new[] { "GitLab-Developers", "VPN-Users", "WiFi-Corp-Access" }),
            ("v.orlov", "Виктор", "Орлов", "Chief Executive Officer (CEO)", "Executive", $"OU=Executive,OU=HQ Moscow,{RootDn}", true, false, 88, "+7 (495) 700-00-01", new[] { "VPN-Users", "WiFi-Corp-Access", "Executive-Board" }),
            ("t.popova", "Татьяна", "Попова", "Senior Legal Counsel", "Finance & Legal", $"OU=Finance & Legal,OU=HQ Moscow,{RootDn}", true, false, 4, "+7 (495) 700-20-15", new[] { "1C-Enterprise-Finance", "VPN-Users" }),
            ("s.vasilyev", "Сергей", "Васильев", "IT Helpdesk Specialist L2", "Engineering", $"OU=Engineering,OU=HQ Moscow,{RootDn}", true, false, 31, "+7 (495) 700-10-55", new[] { "Helpdesk-Operators", "VPN-Users", "WiFi-Corp-Access" }),
            ("a.зайцева", "Анна", "Зайцева", "Talent Acquisition Partner", "HR & Operations", $"OU=HR & Operations,OU=HQ Moscow,{RootDn}", true, false, 27, "+7 (495) 700-30-12", new[] { "HR-Portal-Managers", "WiFi-Corp-Access" }),
            ("p.belov", "Павел", "Белов", "Regional Manager SPb", "Branch SPb", $"OU=Branch SPb,{RootDn}", true, true, 6, "+7 (812) 500-11-01", new[] { "VPN-Users", "WiFi-Corp-Access" }),
            ("svc_gitlab_ldap", "Service", "GitLab LDAP", "Service Account (LDAP Bind)", "Engineering", $"OU=Service Accounts,{RootDn}", true, false, 999, "", new[] { "Service-Accounts-Restricted" }),
            ("svc_1c_server", "Service", "1C Enterprise", "Service Account (1C AppServer)", "Finance & Legal", $"OU=Service Accounts,{RootDn}", true, false, 999, "", new[] { "Service-Accounts-Restricted", "1C-Enterprise-Finance" }),
            ("r.kuznetsov", "Роман", "Кузнецов", "Former QA Engineer (Offboarded)", "Engineering", $"OU=Disabled Users,{RootDn}", false, false, 0, "+7 (495) 700-10-98", Array.Empty<string>())
        };

        int idx = 1001;
        foreach (var u in rawUsers)
        {
            var sam = u.sam == "a.зайцева" ? "a.zaytseva" : u.sam;
            var displayName = $"{u.sur} {u.given}";
            var dn = $"CN={displayName},{u.ou}";
            var memberDns = u.groups.Select(GrpDn).ToList();

            state.Users.Add(new AdUser
            {
                Id = $"usr-{idx}",
                SamAccountName = sam,
                UserPrincipalName = $"{sam}@corp.satella.local",
                DisplayName = displayName,
                GivenName = u.given,
                Surname = u.sur,
                Title = u.title,
                Department = u.dept,
                Company = "Satella Enterprise",
                Office = u.ou.Contains("SPb") ? "SPb Nevsky Office" : "HQ Moscow Tower A",
                Email = $"{sam}@satella.io",
                Telephone = u.phone,
                Mobile = u.phone,
                DistinguishedName = dn,
                OuDn = u.ou,
                Enabled = u.enabled,
                LockedOut = u.locked,
                PasswordNeverExpires = u.pwdDaysLeft > 365,
                MustChangePasswordNextLogon = false,
                PasswordExpiresAt = u.pwdDaysLeft > 365 ? null : DateTime.UtcNow.AddDays(u.pwdDaysLeft),
                LastLogon = DateTime.UtcNow.AddMinutes(-Random.Shared.Next(5, 1800)),
                CreatedAt = DateTime.UtcNow.AddDays(-Random.Shared.Next(30, 600)),
                Description = u.enabled ? $"{u.title} ({u.dept})" : "Уволен / Отключён через Satella Offboarding",
                MemberOf = memberDns,
                CustomAttributes = new Dictionary<string, string>
                {
                    ["employeeID"] = $"EMP-{idx}",
                    ["sAMAccountType"] = "805306368",
                    ["userAccountControl"] = u.enabled ? (u.pwdDaysLeft > 365 ? "66048" : "512") : "514",
                    ["badPwdCount"] = u.locked ? "5" : "0",
                    ["logonCount"] = Random.Shared.Next(45, 920).ToString(),
                    ["homeDirectory"] = $@"\\fs01.corp.satella.local\profiles\{sam}",
                    ["homeDrive"] = "H:",
                    ["objectSid"] = $"S-1-5-21-384920192-948271042-182930412-{idx}"
                }
            });
            idx++;
        }

        // 3. Groups
        var groupDefs = new (string name, string scope, string cat, string desc, string mail)[]
        {
            ("Domain Admins", "Global", "Security", "Полные администраторы домена corp.satella.local", "admins@satella.io"),
            ("VPN-Users", "Global", "Security", "Доступ к корпоративному WireGuard / AnyConnect VPN шлюзу", "vpn-alerts@satella.io"),
            ("GitLab-Developers", "Global", "Security", "Доступ к репозиториям кода, CI/CD пайплайнам и Container Registry", "dev@satella.io"),
            ("Kubernetes-Admins", "Universal", "Security", "Доступ к кластерам Production и Staging K8s через OIDC", "k8s@satella.io"),
            ("1C-Enterprise-Finance", "Global", "Security", "Доступ к серверам 1С:Предприятие 8.3 (Бухгалтерия, ЗУП, ERP)", "finance@satella.io"),
            ("SOC-Analysts", "Global", "Security", "Доступ к SIEM, EDR консоли, журналам безопасности и LAPS паролям", "soc@satella.io"),
            ("Helpdesk-Operators", "DomainLocal", "Security", "Право сброса паролей, разблокировки учёток и подключения по Shadow RDP", "helpdesk@satella.io"),
            ("HR-Portal-Managers", "Global", "Security", "Управление карточками сотрудников и онбординг-заявками", "hr@satella.io"),
            ("WiFi-Corp-Access", "Global", "Security", "Доступ к защищённой корпоративной сети Wi-Fi 802.1X (RADIUS)", ""),
            ("Executive-Board", "Universal", "Distribution", "Закрытая группа рассылки совета директоров", "board@satella.io"),
            ("EDR-Protected-Users", "Global", "Security", "Повышенный профиль защиты рабочих станций (Kaspersky / CrowdStrike)", ""),
            ("Service-Accounts-Restricted", "DomainLocal", "Security", "Групповая политика запрета интерактивного входа для сервисных аккаунтов", "")
        };

        int gIdx = 1;
        foreach (var g in groupDefs)
        {
            var gDn = GrpDn(g.name);
            var members = state.Users
                .Where(u => u.MemberOf.Contains(gDn, StringComparer.OrdinalIgnoreCase))
                .Select(u => u.DistinguishedName)
                .ToList();

            state.Groups.Add(new AdGroup
            {
                Id = $"grp-{gIdx++}",
                SamAccountName = g.name,
                DisplayName = g.name,
                DistinguishedName = gDn,
                OuDn = grpOu,
                GroupScope = g.scope,
                GroupCategory = g.cat,
                Description = g.desc,
                Email = g.mail,
                Members = members,
                CreatedAt = DateTime.UtcNow.AddMonths(-8)
            });
        }

        // 4. Computers
        var compDefs = new (string name, string ou, string os, string ip, string mac, bool online, string user, string desc, int lastLogonDaysAgo)[]
        {
            ("SRV-DC-01", $"OU=Domain Controllers,OU=Servers,{RootDn}", "Windows Server 2022 Datacenter", "10.20.1.10", "00:15:5D:01:01:0A", true, "CORP\\a.volkov", "Primary Domain Controller (FSMO Roles Holder)", 0),
            ("SRV-DC-02", $"OU=Domain Controllers,OU=Servers,{RootDn}", "Windows Server 2022 Datacenter", "10.20.1.11", "00:15:5D:01:01:0B", true, "SYSTEM", "Secondary Domain Controller & DNS/DHCP", 0),
            ("SRV-1C-APP", $"OU=Servers,{RootDn}", "Windows Server 2022 Standard", "10.20.2.25", "00:15:5D:01:02:19", true, "CORP\\svc_1c_server", "Сервер кластера 1С:Предприятие 8.3 + Терминальный сервер", 0),
            ("SRV-SQL-01", $"OU=Servers,{RootDn}", "Windows Server 2022 Datacenter", "10.20.2.26", "00:15:5D:01:02:1A", true, "CORP\\a.volkov", "MS SQL Server 2022 AlwaysOn Primary Node", 0),
            ("WS-ENG-014", $"OU=Engineering PCs,OU=Workstations,{RootDn}", "Windows 11 Enterprise 23H2", "10.20.10.14", "AC:1F:6B:92:10:0E", true, "CORP\\d.morozov", "Рабочая станция: Морозов Дмитрий (Backend)", 0),
            ("WS-ENG-022", $"OU=Engineering PCs,OU=Workstations,{RootDn}", "Windows 11 Enterprise 23H2", "10.20.10.22", "AC:1F:6B:92:10:16", true, "CORP\\k.smirnov", "Рабочая станция: Смирнов Кирилл (DevOps)", 0),
            ("WS-FIN-101", $"OU=Finance PCs,OU=Workstations,{RootDn}", "Windows 11 Enterprise 23H2", "10.20.20.101", "D8:9E:F3:44:20:65", true, "CORP\\m.sokolova", "АРМ Главного бухгалтера (Соколова М.) + USB Токен ЭЦП", 0),
            ("WS-FIN-108", $"OU=Finance PCs,OU=Workstations,{RootDn}", "Windows 11 Enterprise 23H2", "10.20.20.108", "D8:9E:F3:44:20:6C", true, "CORP\\o.novikova", "АРМ Финансового контролёра (Новикова О.)", 0),
            ("WS-SEC-007", $"OU=Workstations,{RootDn}", "Windows 11 Enterprise 23H2", "10.20.15.7", "BC:24:11:77:0F:07", true, "CORP\\i.petrov", "Консоль дежурного аналитика SOC (Петров И.)", 0),
            ("WS-HR-003", $"OU=Workstations,{RootDn}", "Windows 11 Pro 23H2", "10.20.30.3", "BC:24:11:30:00:03", true, "CORP\\e.lebedeva", "Ноутбук HR Директора (Лебедева Е.)", 0),
            ("WS-SPB-019", $"OU=Workstations,{RootDn}", "Windows 10 Enterprise 22H2", "10.20.50.19", "70:85:C2:50:00:13", false, "CORP\\p.belov", "Рабочая станция филиала СПб (Белов П.)", 38),
            ("WS-LEGACY-099", $"OU=Workstations,{RootDn}", "Windows 10 Pro 21H2", "10.20.10.99", "70:85:C2:10:00:63", false, "", "Старый тестовый стенд в переговорной (Неактивен > 45 дней)", 49)
        };

        int cIdx = 1;
        foreach (var c in compDefs)
        {
            var sessions = new List<HostSession>();
            if (c.online && !string.IsNullOrEmpty(c.user) && c.user != "SYSTEM")
            {
                sessions.Add(new HostSession
                {
                    SessionId = 2,
                    Username = c.user,
                    State = "Active",
                    ClientName = c.name.StartsWith("SRV") ? "WS-ENG-014" : "Console",
                    ClientIp = c.name.StartsWith("SRV") ? "10.20.10.14" : "127.0.0.1",
                    LogonTime = DateTime.UtcNow.AddHours(-4)
                });
                if (c.name == "SRV-1C-APP")
                {
                    sessions.Add(new HostSession { SessionId = 3, Username = "CORP\\m.sokolova", State = "Active", ClientName = "WS-FIN-101", ClientIp = "10.20.20.101", LogonTime = DateTime.UtcNow.AddHours(-6) });
                    sessions.Add(new HostSession { SessionId = 4, Username = "CORP\\o.novikova", State = "Active", ClientName = "WS-FIN-108", ClientIp = "10.20.20.108", LogonTime = DateTime.UtcNow.AddHours(-2) });
                }
            }

            state.Computers.Add(new AdComputer
            {
                Id = $"cmp-{cIdx}",
                Name = c.name,
                SamAccountName = $"{c.name}$",
                DnsHostName = $"{c.name.ToLowerInvariant()}.corp.satella.local",
                DistinguishedName = $"CN={c.name},{c.ou}",
                OuDn = c.ou,
                OperatingSystem = c.os,
                OsVersion = c.os.Contains("2022") ? "10.0 (20348)" : "10.0 (22631)",
                IpAddress = c.ip,
                MacAddress = c.mac,
                Enabled = true,
                IsOnline = c.online,
                PingLatencyMs = c.online ? Random.Shared.Next(1, 4) : 0,
                Uptime = c.online ? $"{Random.Shared.Next(2, 28)}d {Random.Shared.Next(1, 23)}h" : "Offline",
                LoggedOnUser = c.user,
                ActiveSessions = sessions,
                LastLogon = DateTime.UtcNow.AddDays(-c.lastLogonDaysAgo),
                Description = c.desc,
                LapsPassword = $"Stl#{cIdx}9!xK{c.name[^2..]}pQ",
                LapsExpiration = DateTime.UtcNow.AddDays(14)
            });
            cIdx++;
        }

        // 5. GPOs
        state.Gpos = new List<AdGpo>
        {
            new()
            {
                Id = "gpo-1",
                Name = "Corp-Baseline-Security-Policy",
                Guid = "{31B2F340-016D-11D2-945F-00C04FB984F9}",
                Status = "AllSettingsEnabled",
                Description = "Базовая политика безопасности домена: сложность паролей (14 символов), порог блокировки (5 ошибок / 15 мин), аудит событий входа.",
                LinkedOus = new()
                {
                    new() { OuDn = RootDn, Enabled = true, Enforced = true, Order = 1 }
                },
                SecurityFiltering = new() { "Authenticated Users" },
                KeySettingsSummary = new()
                {
                    "Minimum Password Length: 14 chars",
                    "Account Lockout Threshold: 5 invalid logon attempts",
                    "Audit Logon Events: Success, Failure",
                    "Windows Defender SmartScreen: Enabled (Block)"
                }
            },
            new()
            {
                Id = "gpo-2",
                Name = "BitLocker-Workstations-AutoEncrypt",
                Guid = "{72A1F990-441B-42E1-991C-81B04FB112A1}",
                Status = "AllSettingsEnabled",
                Description = "Автоматическое шифрование системных дисков BitLocker (TPM 2.0) с сохранением ключей восстановления в AD.",
                LinkedOus = new()
                {
                    new() { OuDn = $"OU=Workstations,{RootDn}", Enabled = true, Enforced = false, Order = 1 }
                },
                SecurityFiltering = new() { "Domain Computers" },
                KeySettingsSummary = new()
                {
                    "Store BitLocker recovery information in AD DS: Enabled",
                    "Encryption Method: XTS-AES 256-bit",
                    "Require TPM startup: Enabled"
                }
            },
            new()
            {
                Id = "gpo-3",
                Name = "Finance-Restrict-Removable-USB",
                Guid = "{98C4E120-77B2-4F81-A82C-19C04FA883E4}",
                Status = "AllSettingsEnabled",
                Description = "Запрет записи на внешние USB-накопители для ПК финансового департамента (разрешены только USB-токены ЭЦП Рутокен/JaCarta).",
                LinkedOus = new()
                {
                    new() { OuDn = $"OU=Finance & Legal,OU=HQ Moscow,{RootDn}", Enabled = true, Enforced = true, Order = 1 },
                    new() { OuDn = $"OU=Finance PCs,OU=Workstations,{RootDn}", Enabled = true, Enforced = true, Order = 1 }
                },
                SecurityFiltering = new() { "1C-Enterprise-Finance", "Domain Computers" },
                KeySettingsSummary = new()
                {
                    "Removable Disks: Deny write access: Enabled",
                    "Smart Card / Rutoken USB Class GUID: Allowed"
                }
            },
            new()
            {
                Id = "gpo-4",
                Name = "Windows-LAPS-Admin-Rotation",
                Guid = "{44D8A310-12E9-4B21-883D-55A04FC201B8}",
                Status = "AllSettingsEnabled",
                Description = "Ротация пароля локального администратора каждые 14 дней через Windows LAPS с шифрованием в AD.",
                LinkedOus = new()
                {
                    new() { OuDn = $"OU=Workstations,{RootDn}", Enabled = true, Enforced = false, Order = 2 },
                    new() { OuDn = $"OU=Servers,{RootDn}", Enabled = true, Enforced = false, Order = 1 }
                },
                SecurityFiltering = new() { "Domain Computers" },
                KeySettingsSummary = new()
                {
                    "Backup directory: Active Directory",
                    "Password Age (Days): 14, Length: 16",
                    "Enable password encryption: Enabled"
                }
            },
            new()
            {
                Id = "gpo-6",
                Name = "Shadow-RDP-Helpdesk-Support",
                Guid = "{55E9B421-99F0-4C32-774E-66B04FD312C9}",
                Status = "AllSettingsEnabled",
                Description = "Разрешение теневого подключения (Shadow RDP) для группы Helpdesk-Operators и настройка правил брандмауэра WinRM/WMI.",
                LinkedOus = new()
                {
                    new() { OuDn = $"OU=Workstations,{RootDn}", Enabled = true, Enforced = false, Order = 3 },
                    new() { OuDn = $"OU=Servers,{RootDn}", Enabled = true, Enforced = false, Order = 2 }
                },
                SecurityFiltering = new() { "Domain Computers", "Helpdesk-Operators" },
                KeySettingsSummary = new()
                {
                    "Set rules for remote control of Remote Desktop Services user sessions: Full Control with user's permission",
                    "WinRM Service Automatic Start & Firewall Rule: Enabled"
                }
            }
        };

        // 6. ACL Rules
        state.AclRules = new List<AclRule>
        {
            new() { Id = "acl-1", TargetDn = RootDn, IdentityReference = "CORP\\Domain Admins", AccessControlType = "Allow", ActiveDirectoryRights = "GenericAll (Full Control)", InheritanceType = "All", IsInherited = false },
            new() { Id = "acl-2", TargetDn = $"OU=HQ Moscow,{RootDn}", IdentityReference = "CORP\\Helpdesk-Operators", AccessControlType = "Allow", ActiveDirectoryRights = "ResetPassword, WriteProperty (lockoutTime, pwdLastSet)", InheritanceType = "Descendents (User objects)", IsInherited = false },
            new() { Id = "acl-3", TargetDn = $"OU=HQ Moscow,{RootDn}", IdentityReference = "CORP\\HR-Portal-Managers", AccessControlType = "Allow", ActiveDirectoryRights = "WriteProperty (title, department, telephoneNumber, manager)", InheritanceType = "Descendents (User objects)", IsInherited = false },
            new() { Id = "acl-4", TargetDn = $"OU=Workstations,{RootDn}", IdentityReference = "CORP\\SOC-Analysts", AccessControlType = "Allow", ActiveDirectoryRights = "ReadControl, ms-Mcs-AdmPwd (Read LAPS Password)", InheritanceType = "Descendents (Computer objects)", IsInherited = false },
            new() { Id = "acl-5", TargetDn = $"OU=Workstations,{RootDn}", IdentityReference = "CORP\\Helpdesk-Operators", AccessControlType = "Allow", ActiveDirectoryRights = "CreateChild, DeleteChild (Computer objects)", InheritanceType = "All", IsInherited = false },
            new() { Id = "acl-6", TargetDn = $"OU=Security & SOC,OU=HQ Moscow,{RootDn}", IdentityReference = "CORP\\Helpdesk-Operators", AccessControlType = "Deny", ActiveDirectoryRights = "ResetPassword (Защита учёток ИБ от сброса пароля первой линией)", InheritanceType = "All", IsInherited = false }
        };

        // 7. DNS Records & DHCP Leases
        state.DnsRecords = new List<DnsRecord>
        {
            new() { Id = "dns-1", ZoneName = "corp.satella.local", Name = "@", RecordType = "A", Data = "10.20.1.10", TtlSeconds = 600, IsStatic = true },
            new() { Id = "dns-2", ZoneName = "corp.satella.local", Name = "srv-dc-01", RecordType = "A", Data = "10.20.1.10", TtlSeconds = 3600, IsStatic = true },
            new() { Id = "dns-3", ZoneName = "corp.satella.local", Name = "srv-dc-02", RecordType = "A", Data = "10.20.1.11", TtlSeconds = 3600, IsStatic = true },
            new() { Id = "dns-4", ZoneName = "corp.satella.local", Name = "srv-1c-app", RecordType = "A", Data = "10.20.2.25", TtlSeconds = 3600, IsStatic = true },
            new() { Id = "dns-5", ZoneName = "corp.satella.local", Name = "srv-sql-01", RecordType = "A", Data = "10.20.2.26", TtlSeconds = 3600, IsStatic = true },
            new() { Id = "dns-6", ZoneName = "corp.satella.local", Name = "gitlab", RecordType = "CNAME", Data = "srv-sql-01.corp.satella.local", TtlSeconds = 1800, IsStatic = true },
            new() { Id = "dns-7", ZoneName = "corp.satella.local", Name = "fs01", RecordType = "A", Data = "10.20.2.30", TtlSeconds = 3600, IsStatic = true },
            new() { Id = "dns-8", ZoneName = "corp.satella.local", Name = "_ldap._tcp.dc._msdcs", RecordType = "SRV", Data = "0 100 389 srv-dc-01.corp.satella.local.", TtlSeconds = 600, IsStatic = true },
            new() { Id = "dns-9", ZoneName = "corp.satella.local", Name = "ws-eng-014", RecordType = "A", Data = "10.20.10.14", TtlSeconds = 1200, IsStatic = false, Timestamp = "Dynamic" },
            new() { Id = "dns-10", ZoneName = "corp.satella.local", Name = "ws-fin-101", RecordType = "A", Data = "10.20.20.101", TtlSeconds = 1200, IsStatic = false, Timestamp = "Dynamic" }
        };

        state.DhcpLeases = state.Computers
            .Where(c => !c.Name.StartsWith("SRV"))
            .Select((c, i) => new DhcpLease
            {
                Id = $"dhcp-{i + 1}",
                ScopeId = c.IpAddress.StartsWith("10.20.20") ? "10.20.20.0/24 (VLAN 20 Finance)" : "10.20.10.0/24 (VLAN 10 Workstations)",
                IpAddress = c.IpAddress,
                ClientMac = c.MacAddress,
                HostName = c.DnsHostName,
                LeaseExpires = DateTime.UtcNow.AddDays(7),
                State = c.Name == "WS-FIN-101" ? "Reserved" : (c.IsOnline ? "Active" : "Expired"),
                Description = c.Description
            })
            .ToList();

        // 8. AD Recycle Bin (Deleted Objects)
        state.RecycleBin = new List<RecycleBinObject>
        {
            new()
            {
                Id = "rec-1",
                Name = "Макаров Денис",
                SamAccountName = "d.makarov",
                ObjectClass = "user",
                OriginalDn = $"CN=Макаров Денис,OU=Engineering,OU=HQ Moscow,{RootDn}",
                LastKnownParentDn = $"OU=Engineering,OU=HQ Moscow,{RootDn}",
                DeletedAt = DateTime.UtcNow.AddHours(-5),
                DeletedBy = "CORP\\s.vasilyev"
            },
            new()
            {
                Id = "rec-2",
                Name = "WS-DESIGN-004",
                SamAccountName = "WS-DESIGN-004$",
                ObjectClass = "computer",
                OriginalDn = $"CN=WS-DESIGN-004,OU=Workstations,{RootDn}",
                LastKnownParentDn = $"OU=Workstations,{RootDn}",
                DeletedAt = DateTime.UtcNow.AddDays(-2),
                DeletedBy = "CORP\\a.volkov"
            },
            new()
            {
                Id = "rec-3",
                Name = "Project-Titan-Access",
                SamAccountName = "Project-Titan-Access",
                ObjectClass = "group",
                OriginalDn = $"CN=Project-Titan-Access,OU=Security Groups,{RootDn}",
                LastKnownParentDn = $"OU=Security Groups,{RootDn}",
                DeletedAt = DateTime.UtcNow.AddDays(-4),
                DeletedBy = "CORP\\a.volkov"
            }
        };

        return state;
    }

    public static List<OnboardingTemplate> CreateDefaultTemplates() => new()
    {
        new()
        {
            Id = "tpl-eng",
            Name = "Backend / DevOps Инженер",
            Description = "Создаёт учётку в OU=Engineering, выдаёт доступы к VPN, GitLab, Kubernetes и корпоративному Wi-Fi.",
            RoleCategory = "Engineering",
            TargetOuDn = $"OU=Engineering,OU=HQ Moscow,{RootDn}",
            Title = "Software Engineer",
            Department = "Engineering",
            Company = "Satella Enterprise",
            Office = "HQ Moscow Tower A",
            DefaultGroups = new()
            {
                $"CN=VPN-Users,OU=Security Groups,{RootDn}",
                $"CN=GitLab-Developers,OU=Security Groups,{RootDn}",
                $"CN=Kubernetes-Admins,OU=Security Groups,{RootDn}",
                $"CN=WiFi-Corp-Access,OU=Security Groups,{RootDn}"
            },
            MustChangePassword = true
        },
        new()
        {
            Id = "tpl-fin",
            Name = "Бухгалтер / Финансист (1С)",
            Description = "Создаёт учётку в OU=Finance & Legal, подключает к серверам 1С:Предприятие и усиленному профилю EDR.",
            RoleCategory = "Finance",
            TargetOuDn = $"OU=Finance & Legal,OU=HQ Moscow,{RootDn}",
            Title = "Senior Accountant",
            Department = "Finance & Legal",
            Company = "Satella Enterprise",
            Office = "HQ Moscow Tower A",
            DefaultGroups = new()
            {
                $"CN=1C-Enterprise-Finance,OU=Security Groups,{RootDn}",
                $"CN=EDR-Protected-Users,OU=Security Groups,{RootDn}",
                $"CN=WiFi-Corp-Access,OU=Security Groups,{RootDn}"
            },
            MustChangePassword = true
        },
        new()
        {
            Id = "tpl-soc",
            Name = "Дежурный аналитик ИБ (SOC)",
            Description = "Создаёт учётку в OU=Security & SOC с правами чтения LAPS, мониторинга событий и работы в Helpdesk.",
            RoleCategory = "Security",
            TargetOuDn = $"OU=Security & SOC,OU=HQ Moscow,{RootDn}",
            Title = "SOC Security Analyst",
            Department = "Security & SOC",
            Company = "Satella Enterprise",
            Office = "HQ Moscow SOC Room",
            DefaultGroups = new()
            {
                $"CN=SOC-Analysts,OU=Security Groups,{RootDn}",
                $"CN=Helpdesk-Operators,OU=Security Groups,{RootDn}",
                $"CN=VPN-Users,OU=Security Groups,{RootDn}"
            },
            MustChangePassword = true
        },
        new()
        {
            Id = "tpl-hr",
            Name = "HR Менеджер / Рекрутер",
            Description = "Создаёт учётку в OU=HR & Operations с делегированными правами редактирования должностей и телефонов.",
            RoleCategory = "HR",
            TargetOuDn = $"OU=HR & Operations,OU=HQ Moscow,{RootDn}",
            Title = "HR Specialist",
            Department = "HR & Operations",
            Company = "Satella Enterprise",
            Office = "HQ Moscow Tower A",
            DefaultGroups = new()
            {
                $"CN=HR-Portal-Managers,OU=Security Groups,{RootDn}",
                $"CN=WiFi-Corp-Access,OU=Security Groups,{RootDn}"
            },
            MustChangePassword = true
        }
    };
}

