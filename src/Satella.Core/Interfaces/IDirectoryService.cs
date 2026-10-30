using Satella.Core.Models;

namespace Satella.Core.Interfaces;

public record CreateUserRequest(
    string SamAccountName,
    string GivenName,
    string Surname,
    string DisplayName,
    string Title,
    string Department,
    string Company,
    string Office,
    string Email,
    string Telephone,
    string OuDn,
    string Password,
    bool Enabled,
    bool MustChangePasswordNextLogon,
    List<string> MemberOf
);

public record UpdateUserRequest(
    string Id,
    string DisplayName,
    string GivenName,
    string Surname,
    string Title,
    string Department,
    string Company,
    string Office,
    string Email,
    string Telephone,
    string Description,
    bool Enabled,
    bool PasswordNeverExpires,
    List<string> MemberOf,
    Dictionary<string, string> CustomAttributes,
    string? SamAccountName = null,
    string? UserPrincipalName = null,
    string? Mobile = null,
    string? ManagerDn = null,
    bool? MustChangePasswordNextLogon = null,
    bool? LockedOut = null
);

public record ResetPasswordRequest(string UserId, string NewPassword, bool MustChangeNextLogon, bool UnlockAccount);

public record BulkUserActionRequest(List<string> UserIds, string Action, string? TargetOuDn, string? GroupDn);

public record CreateGroupRequest(string SamAccountName, string DisplayName, string OuDn, string GroupScope, string GroupCategory, string Description, string Email);

public record CreateOuRequest(string Name, string ParentDn, string Description, bool ProtectedFromAccidentalDeletion);

public record OnboardEmployeeRequest(string TemplateId, string GivenName, string Surname, string SamAccountName, string Email, string Telephone, string Password);

public record DeployScriptRequest(List<string> ComputerIds, string ScriptName, string PowerShellCode);

public record CreateDnsRecordRequest(string ZoneName, string Name, string RecordType, string Data, int TtlSeconds);

public record CreateAclRuleRequest(string TargetDn, string IdentityReference, string AccessControlType, string ActiveDirectoryRights);
public record CreateJitGrantRequest(string UserId, string GroupId, int DurationMinutes, string Reason);
public record TransferFsmoRequest(string RoleName, string TargetDcName);

public interface IDirectoryService
{
    // Profiles
    List<DomainProfile> GetProfiles();
    DomainProfile GetActiveProfile();
    CommandResult<DomainProfile> SwitchProfile(string profileId);
    CommandResult<DomainProfile> SaveProfile(DomainProfile profile, string? plainPassword);
    CommandResult<DomainProfile> DetectCurrentWindowsDomain();
    CommandResult<string> TestConnection(DomainProfile profile, string? plainPassword);
    CommandResult<int> SyncActiveDomain();
    CommandResult<bool> ResetSandboxData();

    // Dashboard & Global Search
    DashboardStats GetDashboardStats();
    List<OuNode> GetOuTree();
    CommandResult<OuNode> CreateOu(CreateOuRequest request);

    // Users
    List<AdUser> GetUsers(string? ouDn = null, string? search = null, string? statusFilter = null);
    AdUser? GetUserById(string id);
    CommandResult<AdUser> CreateUser(CreateUserRequest request);
    CommandResult<AdUser> UpdateUser(UpdateUserRequest request);
    CommandResult<AdUser> ResetPassword(ResetPasswordRequest request);
    CommandResult<AdUser> UnlockUser(string userId);
    CommandResult<AdUser> ToggleUserEnabled(string userId, bool enabled);
    CommandResult<AdUser> OffboardUser(string userId);
    CommandResult<bool> DeleteUser(string userId);
    CommandResult<int> BulkUserAction(BulkUserActionRequest request);

    // Move objects (Drag & Drop)
    CommandResult<bool> MoveObjectToOu(string objectId, string objectClass, string targetOuDn);

    // Groups
    List<AdGroup> GetGroups(string? ouDn = null, string? search = null);
    CommandResult<AdGroup> CreateGroup(CreateGroupRequest request);
    CommandResult<AdGroup> UpdateGroupMembers(string groupId, List<string> memberDns);

    // Computers & Remote Management & LAPS
    List<AdComputer> GetComputers(string? ouDn = null, string? search = null);
    CommandResult<AdComputer> RotateLapsPassword(string computerId, int expirationDays);
    CommandResult<string> LaunchRemoteSession(string computerId, int sessionId, string protocol, bool control);
    CommandResult<bool> PowerActionComputer(string computerId, string action, string reason);
    List<RemoteProcessInfo> GetRemoteProcesses(string computerId);
    CommandResult<bool> KillRemoteProcess(string computerId, int pid);
    List<RemoteServiceInfo> GetRemoteServices(string computerId);
    CommandResult<RemoteServiceInfo> ToggleRemoteService(string computerId, string serviceName, string action);
    List<RemoteEventLogEntry> GetRemoteEventLogs(string computerId);
    CommandResult<List<ScriptExecutionResult>> ExecuteScriptOnComputers(DeployScriptRequest request);

    // Onboarding Templates
    List<OnboardingTemplate> GetTemplates();
    CommandResult<OnboardingTemplate> SaveTemplate(OnboardingTemplate template);
    CommandResult<bool> DeleteTemplate(string templateId);
    CommandResult<AdUser> ExecuteOnboarding(OnboardEmployeeRequest request);

    // Audit, Rollback & Recycle Bin
    List<AuditActionEntry> GetAuditLogs();
    CommandResult<AuditActionEntry> RollbackAction(string auditId);
    List<RecycleBinObject> GetRecycleBin();
    CommandResult<bool> RestoreRecycleBinObject(string recycleId);

    // GPO, ACL, DNS & DHCP
    List<AdGpo> GetGpos();
    CommandResult<AdGpo> SaveGpo(AdGpo gpo);
    CommandResult<bool> DeleteGpo(string gpoId);
    CommandResult<AdGpo> ToggleGpoLink(string gpoId, string ouDn, bool enabled, bool enforced);
    CommandResult<bool> RunGpUpdate(string targetDnOrHost);
    List<AclRule> GetAclRules(string? targetDn = null);
    CommandResult<AclRule> CreateAclRule(CreateAclRuleRequest request);
    List<DnsRecord> GetDnsRecords();
    CommandResult<DnsRecord> CreateDnsRecord(CreateDnsRecordRequest request);
    CommandResult<bool> DeleteDnsRecord(string id);
    List<DhcpLease> GetDhcpLeases();
    CommandResult<DhcpLease> ConvertDhcpToReservation(string leaseId);

    // Security Scanner, JIT PAM, DC Health/FSMO & BitLocker
    List<SecurityFinding> RunSecurityScan();
    CommandResult<SecurityFinding> FixSecurityFinding(string findingId);
    List<JitAccessGrant> GetJitGrants();
    CommandResult<JitAccessGrant> CreateJitGrant(CreateJitGrantRequest request);
    CommandResult<bool> RevokeJitGrant(string grantId);
    List<DomainControllerStatus> GetDomainControllers();
    CommandResult<List<DomainControllerStatus>> TransferFsmoRole(TransferFsmoRequest request);
    CommandResult<List<DomainControllerStatus>> ForceDcReplication();
    List<(AdComputer Computer, BitLockerRecoveryKey Key)> GetBitLockerKeys(string? search = null);
}

