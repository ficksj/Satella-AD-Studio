export interface DomainProfile {
  id: string;
  name: string;
  domainName: string;
  dcHost: string;
  port: number;
  useSsl: boolean;
  useCurrentUserSso: boolean;
  username: string;
  encryptedPassword?: string;
  isSandbox: boolean;
  isActive: boolean;
  lastConnectedAt: string;
}

export interface OuNode {
  id: string;
  name: string;
  distinguishedName: string;
  parentDn: string;
  description: string;
  protectedFromAccidentalDeletion: boolean;
  userCount: number;
  computerCount: number;
  groupCount: number;
  linkedGpoIds: string[];
  children: OuNode[];
}

export interface AdUser {
  id: string;
  samAccountName: string;
  userPrincipalName: string;
  displayName: string;
  givenName: string;
  surname: string;
  title: string;
  department: string;
  company: string;
  managerDn: string;
  email: string;
  telephone: string;
  mobile: string;
  office: string;
  distinguishedName: string;
  ouDn: string;
  enabled: boolean;
  lockedOut: boolean;
  passwordNeverExpires: boolean;
  mustChangePasswordNextLogon: boolean;
  passwordExpiresAt?: string | null;
  lastLogon?: string | null;
  createdAt: string;
  description: string;
  memberOf: string[];
  customAttributes: Record<string, string>;
}

export interface AdGroup {
  id: string;
  samAccountName: string;
  displayName: string;
  distinguishedName: string;
  ouDn: string;
  groupScope: string;
  groupCategory: string;
  description: string;
  email: string;
  members: string[];
  managedByDn: string;
  createdAt: string;
}

export interface HostSession {
  sessionId: number;
  username: string;
  state: string;
  clientName: string;
  clientIp: string;
  logonTime: string;
}

export interface AdComputer {
  id: string;
  name: string;
  samAccountName: string;
  dnsHostName: string;
  distinguishedName: string;
  ouDn: string;
  operatingSystem: string;
  osVersion: string;
  ipAddress: string;
  macAddress: string;
  enabled: boolean;
  isOnline: boolean;
  pingLatencyMs: number;
  uptime: string;
  loggedOnUser: string;
  activeSessions: HostSession[];
  lastLogon?: string | null;
  description: string;
  lapsPassword: string;
  lapsExpiration?: string | null;
}

export interface RemoteProcessInfo {
  pid: number;
  name: string;
  cpuPercent: number;
  memoryMb: number;
  username: string;
  windowTitle: string;
}

export interface RemoteServiceInfo {
  name: string;
  displayName: string;
  status: string;
  startType: string;
}

export interface RemoteEventLogEntry {
  id: string;
  eventId: number;
  level: string;
  source: string;
  logName: string;
  timeCreated: string;
  message: string;
}

export interface GpoLink {
  ouDn: string;
  enabled: boolean;
  enforced: boolean;
  order: number;
}

export interface AdGpo {
  id: string;
  name: string;
  guid: string;
  status: string;
  linkedOus: GpoLink[];
  securityFiltering: string[];
  wmiFilter: string;
  createdAt: string;
  modifiedAt: string;
  description: string;
  keySettingsSummary: string[];
}

export interface AclRule {
  id: string;
  targetDn: string;
  identityReference: string;
  accessControlType: string;
  activeDirectoryRights: string;
  inheritanceType: string;
  isInherited: boolean;
}

export interface DnsRecord {
  id: string;
  zoneName: string;
  name: string;
  recordType: string;
  data: string;
  ttlSeconds: number;
  timestamp: string;
  isStatic: boolean;
}

export interface DhcpLease {
  id: string;
  scopeId: string;
  ipAddress: string;
  clientMac: string;
  hostName: string;
  leaseExpires?: string | null;
  state: string;
  description: string;
}

export interface RecycleBinObject {
  id: string;
  name: string;
  samAccountName: string;
  objectClass: string;
  originalDn: string;
  lastKnownParentDn: string;
  deletedAt: string;
  deletedBy: string;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description: string;
  roleCategory: string;
  targetOuDn: string;
  title: string;
  department: string;
  company: string;
  office: string;
  defaultGroups: string[];
  homeDirectoryPattern: string;
  mustChangePassword: boolean;
}

export interface AuditActionEntry {
  id: string;
  timestamp: string;
  actor: string;
  profileName: string;
  actionType: string;
  targetDn: string;
  targetName: string;
  targetClass: string;
  summary: string;
  powerShellScript: string;
  canRollback: boolean;
  isRolledBack: boolean;
}

export interface DashboardStats {
  domainName: string;
  dcHost: string;
  forestMode: string;
  domainMode: string;
  isSandbox: boolean;
  totalUsers: number;
  activeUsers: number;
  lockedOutUsers: number;
  disabledUsers: number;
  expiringPasswordsCount: number;
  totalGroups: number;
  totalComputers: number;
  onlineComputers: number;
  totalOus: number;
  totalGpos: number;
  recycleBinCount: number;
  lockedUsersList: AdUser[];
  expiringPasswordUsers: AdUser[];
  inactiveComputers: AdComputer[];
  recentAuditLogs: AuditActionEntry[];
}

export interface ScriptExecutionResult {
  computerName: string;
  ipAddress: string;
  success: boolean;
  exitCode: number;
  durationMs: number;
  output: string;
}

export interface CommandResult<T> {
  success: boolean;
  message: string;
  data?: T;
  generatedPowerShell: string;
  auditEntryId?: string;
}

