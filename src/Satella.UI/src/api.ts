import type {
  AdComputer,
  AdGpo,
  AdGroup,
  AdUser,
  AclRule,
  AuditActionEntry,
  CommandResult,
  DashboardStats,
  DhcpLease,
  DnsRecord,
  DomainProfile,
  OnboardingTemplate,
  OuNode,
  RecycleBinObject,
  RemoteEventLogEntry,
  RemoteProcessInfo,
  RemoteServiceInfo,
  ScriptExecutionResult,
} from './types';

const API_BASE =
  window.location.port === '5173' ? 'http://127.0.0.1:17420/api' : '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API Error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export const api = {
  // Profiles
  getProfiles: () => request<DomainProfile[]>('/profiles'),
  getActiveProfile: () => request<DomainProfile>('/profiles/active'),
  detectDomain: () => request<CommandResult<DomainProfile>>('/profiles/detect'),
  testProfile: (profile: DomainProfile, plainPassword?: string) =>
    request<CommandResult<string>>('/profiles/test', {
      method: 'POST',
      body: JSON.stringify({ profile, plainPassword }),
    }),
  syncDomain: () =>
    request<CommandResult<number>>('/profiles/sync', { method: 'POST' }),
  switchProfile: (id: string) =>
    request<CommandResult<DomainProfile>>(`/profiles/switch/${id}`, { method: 'POST' }),
  saveProfile: (profile: DomainProfile, plainPassword?: string) =>
    request<CommandResult<DomainProfile>>('/profiles/save', {
      method: 'POST',
      body: JSON.stringify({ profile, plainPassword }),
    }),
  resetSandbox: () =>
    request<CommandResult<boolean>>('/sandbox/reset', { method: 'POST' }),

  // Dashboard & OUs
  getDashboard: () => request<DashboardStats>('/dashboard'),
  getOuTree: () => request<OuNode[]>('/ous'),
  createOu: (data: {
    name: string;
    parentDn: string;
    description: string;
    protectedFromAccidentalDeletion: boolean;
  }) =>
    request<CommandResult<OuNode>>('/ous', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  moveObject: (objectId: string, objectClass: string, targetOuDn: string) =>
    request<CommandResult<boolean>>('/objects/move', {
      method: 'POST',
      body: JSON.stringify({ objectId, objectClass, targetOuDn }),
    }),

  // Users
  getUsers: (ouDn?: string, search?: string, status?: string) => {
    const params = new URLSearchParams();
    if (ouDn) params.set('ouDn', ouDn);
    if (search) params.set('search', search);
    if (status && status !== 'all') params.set('status', status);
    const qs = params.toString();
    return request<AdUser[]>(`/users${qs ? `?${qs}` : ''}`);
  },
  createUser: (data: Record<string, unknown>) =>
    request<CommandResult<AdUser>>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (data: Record<string, unknown>) =>
    request<CommandResult<AdUser>>('/users', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  resetPassword: (data: {
    userId: string;
    newPassword: string;
    mustChangeNextLogon: boolean;
    unlockAccount: boolean;
  }) =>
    request<CommandResult<AdUser>>('/users/reset-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  unlockUser: (id: string) =>
    request<CommandResult<AdUser>>(`/users/${id}/unlock`, { method: 'POST' }),
  toggleUserEnabled: (userId: string, enabled: boolean) =>
    request<CommandResult<AdUser>>('/users/toggle-enabled', {
      method: 'POST',
      body: JSON.stringify({ userId, enabled }),
    }),
  offboardUser: (id: string) =>
    request<CommandResult<AdUser>>(`/users/${id}/offboard`, { method: 'POST' }),
  deleteUser: (id: string) =>
    request<CommandResult<boolean>>(`/users/${id}`, { method: 'DELETE' }),
  bulkUserAction: (data: {
    userIds: string[];
    action: string;
    targetOuDn?: string;
    groupDn?: string;
  }) =>
    request<CommandResult<number>>('/users/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Groups
  getGroups: (ouDn?: string, search?: string) => {
    const params = new URLSearchParams();
    if (ouDn) params.set('ouDn', ouDn);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request<AdGroup[]>(`/groups${qs ? `?${qs}` : ''}`);
  },
  createGroup: (data: Record<string, unknown>) =>
    request<CommandResult<AdGroup>>('/groups', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateGroupMembers: (groupId: string, memberDns: string[]) =>
    request<CommandResult<AdGroup>>('/groups/members', {
      method: 'PUT',
      body: JSON.stringify({ groupId, memberDns }),
    }),

  // Computers & Remote Management & LAPS
  getComputers: (ouDn?: string, search?: string) => {
    const params = new URLSearchParams();
    if (ouDn) params.set('ouDn', ouDn);
    if (search) params.set('search', search);
    const qs = params.toString();
    return request<AdComputer[]>(`/computers${qs ? `?${qs}` : ''}`);
  },
  rotateLaps: (computerId: string, days = 14) =>
    request<CommandResult<AdComputer>>(
      `/computers/${computerId}/laps-rotate?days=${days}`,
      { method: 'POST' }
    ),
  launchRemoteSession: (
    computerId: string,
    sessionId: number,
    protocol: string,
    control: boolean
  ) =>
    request<CommandResult<string>>('/computers/remote-session', {
      method: 'POST',
      body: JSON.stringify({ computerId, sessionId, protocol, control }),
    }),
  powerComputer: (computerId: string, action: string, reason: string) =>
    request<CommandResult<boolean>>('/computers/power', {
      method: 'POST',
      body: JSON.stringify({ computerId, action, reason }),
    }),
  getRemoteProcesses: (computerId: string) =>
    request<RemoteProcessInfo[]>(`/computers/${computerId}/processes`),
  killRemoteProcess: (computerId: string, pid: number) =>
    request<CommandResult<boolean>>('/computers/kill-process', {
      method: 'POST',
      body: JSON.stringify({ computerId, pid }),
    }),
  getRemoteServices: (computerId: string) =>
    request<RemoteServiceInfo[]>(`/computers/${computerId}/services`),
  toggleRemoteService: (computerId: string, serviceName: string, action: string) =>
    request<CommandResult<RemoteServiceInfo>>('/computers/toggle-service', {
      method: 'POST',
      body: JSON.stringify({ computerId, serviceName, action }),
    }),
  getRemoteEvents: (computerId: string) =>
    request<RemoteEventLogEntry[]>(`/computers/${computerId}/events`),
  deployScript: (computerIds: string[], scriptName: string, powerShellCode: string) =>
    request<CommandResult<ScriptExecutionResult[]>>('/computers/deploy-script', {
      method: 'POST',
      body: JSON.stringify({ computerIds, scriptName, powerShellCode }),
    }),

  // Templates & Onboarding
  getTemplates: () => request<OnboardingTemplate[]>('/templates'),
  saveTemplate: (tpl: OnboardingTemplate) =>
    request<CommandResult<OnboardingTemplate>>('/templates', {
      method: 'POST',
      body: JSON.stringify(tpl),
    }),
  deleteTemplate: (id: string) =>
    request<CommandResult<boolean>>(`/templates/${id}`, { method: 'DELETE' }),
  executeOnboarding: (data: {
    templateId: string;
    givenName: string;
    surname: string;
    samAccountName: string;
    email: string;
    telephone: string;
    password: string;
  }) =>
    request<CommandResult<AdUser>>('/onboarding/execute', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Audit, Rollback & Recycle Bin
  getAuditLogs: () => request<AuditActionEntry[]>('/audit'),
  rollbackAction: (id: string) =>
    request<CommandResult<AuditActionEntry>>(`/audit/${id}/rollback`, {
      method: 'POST',
    }),
  getRecycleBin: () => request<RecycleBinObject[]>('/recycle-bin'),
  restoreRecycleBin: (id: string) =>
    request<CommandResult<boolean>>(`/recycle-bin/${id}/restore`, {
      method: 'POST',
    }),

  // GPO, ACL, DNS & DHCP
  getGpos: () => request<AdGpo[]>('/gpos'),
  saveGpo: (gpo: AdGpo) =>
    request<CommandResult<AdGpo>>('/gpos', {
      method: 'POST',
      body: JSON.stringify(gpo),
    }),
  deleteGpo: (id: string) =>
    request<CommandResult<boolean>>(`/gpos/${id}`, { method: 'DELETE' }),
  toggleGpoLink: (gpoId: string, ouDn: string, enabled: boolean, enforced: boolean) =>
    request<CommandResult<AdGpo>>('/gpos/toggle-link', {
      method: 'POST',
      body: JSON.stringify({ gpoId, ouDn, enabled, enforced }),
    }),
  runGpUpdate: (target: string) =>
    request<CommandResult<boolean>>(
      `/gpos/gpupdate?target=${encodeURIComponent(target)}`,
      { method: 'POST' }
    ),
  getAcls: (targetDn?: string) =>
    request<AclRule[]>(
      `/acls${targetDn ? `?targetDn=${encodeURIComponent(targetDn)}` : ''}`
    ),
  createAcl: (data: {
    targetDn: string;
    identityReference: string;
    accessControlType: string;
    activeDirectoryRights: string;
  }) =>
    request<CommandResult<AclRule>>('/acls', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getDns: () => request<DnsRecord[]>('/dns'),
  createDns: (data: {
    zoneName: string;
    name: string;
    recordType: string;
    data: string;
    ttlSeconds: number;
  }) =>
    request<CommandResult<DnsRecord>>('/dns', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteDns: (id: string) =>
    request<CommandResult<boolean>>(`/dns/${id}`, { method: 'DELETE' }),
  getDhcp: () => request<DhcpLease[]>('/dhcp'),
  reserveDhcp: (id: string) =>
    request<CommandResult<DhcpLease>>(`/dhcp/${id}/reserve`, {
      method: 'POST',
    }),
};

