namespace Satella.Core.Models;

public class DomainProfile
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string DomainName { get; set; } = string.Empty;
    public string DcHost { get; set; } = string.Empty;
    public int Port { get; set; } = 389;
    public bool UseSsl { get; set; }
    public bool UseCurrentUserSso { get; set; } = true;
    public string Username { get; set; } = string.Empty;
    public string? EncryptedPassword { get; set; }
    public bool IsSandbox { get; set; }
    public bool IsActive { get; set; }
    public DateTime LastConnectedAt { get; set; } = DateTime.UtcNow;
}

public class OuNode
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string DistinguishedName { get; set; } = string.Empty;
    public string ParentDn { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool ProtectedFromAccidentalDeletion { get; set; } = true;
    public int UserCount { get; set; }
    public int ComputerCount { get; set; }
    public int GroupCount { get; set; }
    public List<string> LinkedGpoIds { get; set; } = new();
    public List<OuNode> Children { get; set; } = new();
}

public class AdUser
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string SamAccountName { get; set; } = string.Empty;
    public string UserPrincipalName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string GivenName { get; set; } = string.Empty;
    public string Surname { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Company { get; set; } = "Satella Enterprise";
    public string ManagerDn { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Telephone { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string Office { get; set; } = string.Empty;
    public string DistinguishedName { get; set; } = string.Empty;
    public string OuDn { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public bool LockedOut { get; set; }
    public bool PasswordNeverExpires { get; set; }
    public bool MustChangePasswordNextLogon { get; set; }
    public DateTime? PasswordExpiresAt { get; set; }
    public DateTime? LastLogon { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string Description { get; set; } = string.Empty;
    public List<string> MemberOf { get; set; } = new();
    public Dictionary<string, string> CustomAttributes { get; set; } = new();
}

public class AdGroup
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string SamAccountName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string DistinguishedName { get; set; } = string.Empty;
    public string OuDn { get; set; } = string.Empty;
    public string GroupScope { get; set; } = "Global"; // DomainLocal, Global, Universal
    public string GroupCategory { get; set; } = "Security"; // Security, Distribution
    public string Description { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public List<string> Members { get; set; } = new();
    public string ManagedByDn { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class HostSession
{
    public int SessionId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string State { get; set; } = "Active"; // Active, Disconnected
    public string ClientName { get; set; } = string.Empty;
    public string ClientIp { get; set; } = string.Empty;
    public DateTime LogonTime { get; set; } = DateTime.UtcNow.AddHours(-3);
}

public class AdComputer
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string SamAccountName { get; set; } = string.Empty;
    public string DnsHostName { get; set; } = string.Empty;
    public string DistinguishedName { get; set; } = string.Empty;
    public string OuDn { get; set; } = string.Empty;
    public string OperatingSystem { get; set; } = "Windows 11 Enterprise";
    public string OsVersion { get; set; } = "10.0 (22631)";
    public string IpAddress { get; set; } = string.Empty;
    public string MacAddress { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public bool IsOnline { get; set; } = true;
    public int PingLatencyMs { get; set; } = 1;
    public string Uptime { get; set; } = "4d 12h 30m";
    public string LoggedOnUser { get; set; } = string.Empty;
    public List<HostSession> ActiveSessions { get; set; } = new();
    public DateTime? LastLogon { get; set; } = DateTime.UtcNow;
    public string Description { get; set; } = string.Empty;
    public string LapsPassword { get; set; } = string.Empty;
    public DateTime? LapsExpiration { get; set; }
}

public class RemoteProcessInfo
{
    public int Pid { get; set; }
    public string Name { get; set; } = string.Empty;
    public double CpuPercent { get; set; }
    public double MemoryMb { get; set; }
    public string Username { get; set; } = string.Empty;
    public string WindowTitle { get; set; } = string.Empty;
}

public class RemoteServiceInfo
{
    public string Name { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string Status { get; set; } = "Running"; // Running, Stopped
    public string StartType { get; set; } = "Automatic"; // Automatic, Manual, Disabled
}

public class RemoteEventLogEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public int EventId { get; set; }
    public string Level { get; set; } = "Error"; // Error, Warning, Information
    public string Source { get; set; } = string.Empty;
    public string LogName { get; set; } = "System";
    public DateTime TimeCreated { get; set; } = DateTime.UtcNow;
    public string Message { get; set; } = string.Empty;
}

public class GpoLink
{
    public string OuDn { get; set; } = string.Empty;
    public bool Enabled { get; set; } = true;
    public bool Enforced { get; set; }
    public int Order { get; set; } = 1;
}

public class AdGpo
{
    public string Id { get; set; } = System.Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string Guid { get; set; } = string.Empty;
    public string Status { get; set; } = "AllSettingsEnabled";
    public List<GpoLink> LinkedOus { get; set; } = new();
    public List<string> SecurityFiltering { get; set; } = new() { "Authenticated Users" };
    public string WmiFilter { get; set; } = "None";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow.AddMonths(-6);
    public DateTime ModifiedAt { get; set; } = DateTime.UtcNow.AddDays(-2);
    public string Description { get; set; } = string.Empty;
    public List<string> KeySettingsSummary { get; set; } = new();
}

public class AclRule
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string TargetDn { get; set; } = string.Empty;
    public string IdentityReference { get; set; } = string.Empty;
    public string AccessControlType { get; set; } = "Allow"; // Allow, Deny
    public string ActiveDirectoryRights { get; set; } = string.Empty;
    public string InheritanceType { get; set; } = "All"; // None, All, Descendents
    public bool IsInherited { get; set; }
}

public class DnsRecord
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string ZoneName { get; set; } = "corp.satella.local";
    public string Name { get; set; } = string.Empty;
    public string RecordType { get; set; } = "A"; // A, AAAA, CNAME, PTR, SRV, TXT
    public string Data { get; set; } = string.Empty;
    public int TtlSeconds { get; set; } = 3600;
    public string Timestamp { get; set; } = "Static";
    public bool IsStatic { get; set; } = true;
}

public class DhcpLease
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string ScopeId { get; set; } = "10.20.10.0/24";
    public string IpAddress { get; set; } = string.Empty;
    public string ClientMac { get; set; } = string.Empty;
    public string HostName { get; set; } = string.Empty;
    public DateTime? LeaseExpires { get; set; }
    public string State { get; set; } = "Active"; // Active, Reserved, Expired
    public string Description { get; set; } = string.Empty;
}

public class RecycleBinObject
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string SamAccountName { get; set; } = string.Empty;
    public string ObjectClass { get; set; } = "user"; // user, computer, group, organizationalUnit
    public string OriginalDn { get; set; } = string.Empty;
    public string LastKnownParentDn { get; set; } = string.Empty;
    public DateTime DeletedAt { get; set; } = DateTime.UtcNow;
    public string DeletedBy { get; set; } = "CORP\\admin";
    public string SerializedSnapshotJson { get; set; } = string.Empty;
}

public class OnboardingTemplate
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string RoleCategory { get; set; } = "Engineering";
    public string TargetOuDn { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public string Company { get; set; } = "Satella Enterprise";
    public string Office { get; set; } = "HQ Moscow";
    public List<string> DefaultGroups { get; set; } = new();
    public string HomeDirectoryPattern { get; set; } = @"\\fs01.corp.satella.local\profiles\%username%";
    public bool MustChangePassword { get; set; } = true;
}

public class AuditActionEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N");
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    public string Actor { get; set; } = string.Empty;
    public string ProfileName { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string TargetDn { get; set; } = string.Empty;
    public string TargetName { get; set; } = string.Empty;
    public string TargetClass { get; set; } = "user";
    public string Summary { get; set; } = string.Empty;
    public string PowerShellScript { get; set; } = string.Empty;
    public bool CanRollback { get; set; }
    public bool IsRolledBack { get; set; }
    public string RollbackPayloadJson { get; set; } = string.Empty;
}

public class DashboardStats
{
    public string DomainName { get; set; } = string.Empty;
    public string DcHost { get; set; } = string.Empty;
    public string ForestMode { get; set; } = "Windows2016Forest";
    public string DomainMode { get; set; } = "Windows2016Domain";
    public bool IsSandbox { get; set; }
    public int TotalUsers { get; set; }
    public int ActiveUsers { get; set; }
    public int LockedOutUsers { get; set; }
    public int DisabledUsers { get; set; }
    public int ExpiringPasswordsCount { get; set; }
    public int TotalGroups { get; set; }
    public int TotalComputers { get; set; }
    public int OnlineComputers { get; set; }
    public int TotalOus { get; set; }
    public int TotalGpos { get; set; }
    public int RecycleBinCount { get; set; }
    public List<AdUser> LockedUsersList { get; set; } = new();
    public List<AdUser> ExpiringPasswordUsers { get; set; } = new();
    public List<AdComputer> InactiveComputers { get; set; } = new();
    public List<AuditActionEntry> RecentAuditLogs { get; set; } = new();
}

public class ScriptExecutionResult
{
    public string ComputerName { get; set; } = string.Empty;
    public string IpAddress { get; set; } = string.Empty;
    public bool Success { get; set; }
    public int ExitCode { get; set; }
    public int DurationMs { get; set; }
    public string Output { get; set; } = string.Empty;
}

public class CommandResult<T>
{
    public bool Success { get; set; } = true;
    public string Message { get; set; } = string.Empty;
    public T? Data { get; set; }
    public string GeneratedPowerShell { get; set; } = string.Empty;
    public string? AuditEntryId { get; set; }

    public static CommandResult<T> Ok(T data, string message, string psScript = "", string? auditId = null) =>
        new()
        {
            Success = true,
            Data = data,
            Message = message,
            GeneratedPowerShell = psScript,
            AuditEntryId = auditId
        };

    public static CommandResult<T> Fail(string message, string psScript = "") =>
        new()
        {
            Success = false,
            Message = message,
            GeneratedPowerShell = psScript
        };
}
