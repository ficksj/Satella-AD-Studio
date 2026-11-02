import React, { useState } from 'react';
import {
  Network,
  ShieldAlert,
  Unlock,
  UserCheck,
  Users,
  Monitor,
  Wifi,
  KeyRound,
  ExternalLink,
  Search,
  Sparkles,
  ArrowRight,
  Lock,
  CheckCircle2,
  Terminal,
  Plus,
} from 'lucide-react';
import type { AclRule, AdComputer, AdGroup, AdUser } from '../types';

interface Props {
  users: AdUser[];
  groups: AdGroup[];
  computers: AdComputer[];
  acls: AclRule[];
  onOpenUserWindow: (user: AdUser) => void;
  onUpdateUser: (data: Record<string, unknown>) => void;
  onUnlockUser: (userId: string) => void;
  onNotify: (msg: string, ps?: string) => void;
}

interface PsoPolicy {
  id: string;
  name: string;
  precedence: number;
  minPasswordLength: number;
  maxPasswordAgeDays: number;
  lockoutThreshold: number;
  lockoutDurationMins: number;
  reversibleEncryption: boolean;
  complexityEnabled: boolean;
  appliesToGroups: string[];
  description: string;
}

export const OrgAndForensicsView: React.FC<Props> = ({
  users,
  groups,
  computers,
  acls,
  onOpenUserWindow,
  onUpdateUser,
  onUnlockUser,
  onNotify,
}) => {
  const [subTab, setSubTab] = useState<'forensics' | 'orgchart' | 'graph' | 'pso'>(
    'forensics'
  );

  // Org chart state
  const [orgSearch, setOrgSearch] = useState('');
  const [draggedUserId, setDraggedUserId] = useState<string | null>(null);

  // Access Graph state
  const [graphUserId, setGraphUserId] = useState<string>(users[0]?.id || '');

  // Fine-Grained Password Policies (PSO) state
  const [psoList, setPsoList] = useState<PsoPolicy[]>([
    {
      id: 'pso-1',
      name: 'PSO-Tier0-Domain-Admins',
      precedence: 10,
      minPasswordLength: 18,
      maxPasswordAgeDays: 45,
      lockoutThreshold: 3,
      lockoutDurationMins: 60,
      reversibleEncryption: false,
      complexityEnabled: true,
      appliesToGroups: ['Domain Admins', 'Kubernetes-Admins', 'SOC-Analysts'],
      description:
        'Усиленная парольная политика для администраторов инфраструктуры и ИБ (18 символов, блокировка после 3 ошибок)',
    },
    {
      id: 'pso-2',
      name: 'PSO-Finance-1C-Protected',
      precedence: 20,
      minPasswordLength: 14,
      maxPasswordAgeDays: 60,
      lockoutThreshold: 5,
      lockoutDurationMins: 30,
      reversibleEncryption: false,
      complexityEnabled: true,
      appliesToGroups: ['1C-Enterprise-Finance', 'Executive-Board'],
      description:
        'Политика для бухгалтерии, казначейства и руководства компании',
    },
    {
      id: 'pso-3',
      name: 'PSO-Service-Accounts-HighEntropy',
      precedence: 5,
      minPasswordLength: 28,
      maxPasswordAgeDays: 365,
      lockoutThreshold: 0,
      lockoutDurationMins: 0,
      reversibleEncryption: false,
      complexityEnabled: true,
      appliesToGroups: ['Service-Accounts-Restricted'],
      description:
        'Сервисные учётные записи (28 символов, защита от DoS-блокировки при сбоях служб)',
    },
  ]);

  const [newPso, setNewPso] = useState({
    name: 'PSO-Developers-Custom',
    precedence: 30,
    minPasswordLength: 14,
    maxPasswordAgeDays: 90,
    lockoutThreshold: 5,
    lockoutDurationMins: 15,
    appliesToGroup: 'GitLab-Developers',
    description: 'Политика паролей для департамента разработки',
  });

  // Locked users for Lockout Forensics
  const lockedUsers = users.filter((u) => u.lockedOut);

  const handleForensicRemediation = (u: AdUser) => {
    const callerHost =
      u.customAttributes?.['lockoutCallerComputer'] ||
      'SRV-1C-APP.corp.satella.local';
    const service =
      u.customAttributes?.['lockoutService'] || 'RDP / Windows Credential Manager';

    const ps = `# Криминалистика блокировки Event ID 4740 (PDC Emulator) и очистка зависших сессий для ${u.samAccountName}
Get-WinEvent -ComputerName "srv-dc-01.corp.satella.local" -FilterHashtable @{LogName='Security'; Id=4740} -MaxEvents 5
Invoke-Command -ComputerName "${callerHost}" -ScriptBlock {
    # Принудительный сброс зависших токенов Kerberos и отключённых сессий пользователя ${u.samAccountName}
    klist purge
    quser | Where-Object { $_ -match "${u.samAccountName}" }
}
Unlock-ADAccount -Identity "${u.samAccountName}"`;

    onUnlockUser(u.id);
    onNotify(
      `Источник блокировки (${service} на ${callerHost}) сброшен, учётная запись «${u.displayName}» разблокирована!`,
      ps
    );
  };

  // Reassign Manager via Drag-and-Drop or Dropdown
  const handleAssignManager = (employee: AdUser, newManager: AdUser | null) => {
    if (newManager && employee.id === newManager.id) return;
    const newManagerDn = newManager ? newManager.distinguishedName : '';
    const updated: AdUser = {
      ...employee,
      managerDn: newManagerDn,
      customAttributes: {
        ...(employee.customAttributes || {}),
        manager: newManagerDn,
      },
    };
    onUpdateUser(updated as unknown as Record<string, unknown>);
  };

  // Build Org Chart Tree
  const getManagerDn = (u: AdUser) =>
    u.managerDn || u.customAttributes?.['manager'] || '';

  const userByDn = new Map<string, AdUser>();
  users.forEach((u) => userByDn.set(u.distinguishedName.toLowerCase(), u));

  const rootManagers = users.filter((u) => {
    if (u.samAccountName.startsWith('svc_') || !u.enabled) return false;
    const mDn = getManagerDn(u).toLowerCase();
    return !mDn || !userByDn.has(mDn);
  });

  const getDirectReports = (managerDn: string) =>
    users.filter(
      (u) =>
        u.distinguishedName.toLowerCase() !== managerDn.toLowerCase() &&
        getManagerDn(u).toLowerCase() === managerDn.toLowerCase()
    );

  const renderOrgNode = (person: AdUser, level = 0): React.ReactNode => {
    const reports = getDirectReports(person.distinguishedName);
    const matchesSearch =
      !orgSearch.trim() ||
      person.displayName.toLowerCase().includes(orgSearch.toLowerCase()) ||
      person.title.toLowerCase().includes(orgSearch.toLowerCase()) ||
      person.department.toLowerCase().includes(orgSearch.toLowerCase());

    return (
      <div key={person.id} className="space-y-2.5">
        <div
          draggable
          onDragStart={() => setDraggedUserId(person.id)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (draggedUserId && draggedUserId !== person.id) {
              const emp = users.find((x) => x.id === draggedUserId);
              if (emp) handleAssignManager(emp, person);
            }
            setDraggedUserId(null);
          }}
          className={`rounded-md border p-3.5 transition cursor-grab active:cursor-grabbing ${
            matchesSearch && orgSearch.trim()
              ? 'border-indigo-500 bg-emerald-500/10 shadow-lg'
              : level === 0
              ? 'border-emerald-500/30 bg-zinc-900/90'
              : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-md font-bold text-xs ${
                  level === 0
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-800 text-emerald-400 border border-zinc-700'
                }`}
              >
                {person.surname[0]}
                {person.givenName[0]}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-100">
                    {person.displayName}
                  </span>
                  <span className="font-mono text-[11px] text-zinc-400">
                    ({person.samAccountName})
                  </span>
                  {person.lockedOut && (
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
                      LOCKED
                    </span>
                  )}
                  {reports.length > 0 && (
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                      Подчинённых: {reports.length}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-zinc-400">
                  <span className="text-zinc-200 font-medium">{person.title}</span>{' '}
                  • {person.department} • {person.office}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={getManagerDn(person)}
                onChange={(e) => {
                  const mgr = users.find(
                    (u) => u.distinguishedName === e.target.value
                  );
                  handleAssignManager(person, mgr || null);
                }}
                title="Сменить руководителя (Manager)"
                className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300"
              >
                <option value="">Руководитель: Нет (Топ-уровень)</option>
                {users
                  .filter((u) => u.id !== person.id)
                  .map((u) => (
                    <option key={u.id} value={u.distinguishedName}>
                      Начальник: {u.displayName}
                    </option>
                  ))}
              </select>

              <button
                onClick={() => onOpenUserWindow(person)}
                className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700"
              >
                <ExternalLink className="h-3 w-3 text-emerald-400" /> Карточка AD
              </button>
            </div>
          </div>
        </div>

        {reports.length > 0 && (
          <div className="pl-7 border-l-2 border-zinc-800/90 ml-4 space-y-2.5">
            {reports.map((rep) => renderOrgNode(rep, level + 1))}
          </div>
        )}
      </div>
    );
  };

  const selectedGraphUser =
    users.find((u) => u.id === graphUserId) || users[0];

  const userGroupObjects = selectedGraphUser
    ? groups.filter((g) =>
        selectedGraphUser.memberOf.some(
          (m) => m.toLowerCase() === g.distinguishedName.toLowerCase()
        )
      )
    : [];

  const matchedAcls = acls.filter((a) =>
    userGroupObjects.some((g) =>
      a.identityReference.toLowerCase().includes(g.samAccountName.toLowerCase())
    )
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900/50 px-6 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSubTab('forensics')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition ${
              subTab === 'forensics'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <ShieldAlert className="h-4 w-4" />
            <span>Детектор блокировок (Event 4740)</span>
            <span className="rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-rose-300">
              {lockedUsers.length} lock
            </span>
          </button>

          <button
            onClick={() => setSubTab('orgchart')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition ${
              subTab === 'orgchart'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Network className="h-4 w-4" />
            <span>Интерактивная Оргструктура (Org Chart)</span>
          </button>

          <button
            onClick={() => setSubTab('graph')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition ${
              subTab === 'graph'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Граф эффективных прав (BloodHound View)</span>
          </button>

          <button
            onClick={() => setSubTab('pso')}
            className={`flex items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold transition ${
              subTab === 'pso'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>Парольные политики (Fine-Grained PSO)</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* 1. LOCKOUT FORENSICS (Детектор причины блокировки учётки — Event ID 4740) */}
        {subTab === 'forensics' && (
          <div className="space-y-5">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-100">
                  Криминалистика блокировок учётных записей (Account Lockout Forensics — Event ID 4740 / 4625)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Анализ журналов безопасности эмулятора PDC (<code className="text-emerald-400">SRV-DC-01</code>):
                  определение точного хоста, IP-адреса и процесса (RDP, Wi-Fi 802.1X, 1С, SMB), который блокирует пароль сотрудника.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs">
                  <span className="text-zinc-400">Активных блокировок: </span>
                  <span className="font-bold text-rose-400">{lockedUsers.length}</span>
                </div>
              </div>
            </div>

            {lockedUsers.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-10 text-center space-y-2">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
                <div className="text-sm font-bold text-zinc-100">
                  В домене нет заблокированных учётных записей!
                </div>
                <p className="text-xs text-zinc-400">
                  Все инциденты Event ID 4740 устранены, зависшие сессии очищены.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {lockedUsers.map((u) => {
                  const callerComp =
                    u.customAttributes?.['lockoutCallerComputer'] ||
                    'SRV-1C-APP.corp.satella.local';
                  const callerIp =
                    u.customAttributes?.['lockoutCallerIp'] || '10.20.2.25';
                  const service =
                    u.customAttributes?.['lockoutService'] ||
                    'Терминальная сессия RDP / Windows Credential Manager';
                  const reason =
                    u.customAttributes?.['lockoutReason'] ||
                    'Превышен порог неверных попыток ввода пароля (badPwdCount = 5) из-за фонового переподключения со старым паролем.';
                  const eventCode =
                    u.customAttributes?.['lockoutEventId'] ||
                    'Event ID 4740 (PDC: SRV-DC-01)';

                  return (
                    <div
                      key={u.id}
                      className="rounded-lg border border-rose-500/30 bg-zinc-900/80 p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                              LOCKED OUT • badPwdCount: {u.customAttributes?.['badPwdCount'] || '5'}
                            </span>
                            <span className="rounded-md bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                              {eventCode}
                            </span>
                            <span className="text-sm font-bold text-zinc-100">
                              {u.displayName} ({u.samAccountName})
                            </span>
                            <span className="text-xs text-zinc-400">
                              — {u.title} ({u.department})
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 pt-1">{reason}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onOpenUserWindow(u)}
                            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                          >
                            Свойства AD
                          </button>
                          <button
                            onClick={() => handleForensicRemediation(u)}
                            className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition"
                          >
                            <Unlock className="h-4 w-4" />
                            <span>Сбросить сессии и разблокировать</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                          <div className="text-[10px] uppercase text-zinc-500">
                            Узел-источник блокировки (Caller Computer)
                          </div>
                          <div className="mt-1 flex items-center gap-2 font-mono font-semibold text-amber-300">
                            <Monitor className="h-3.5 w-3.5" />
                            {callerComp} ({callerIp})
                          </div>
                        </div>

                        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                          <div className="text-[10px] uppercase text-zinc-500">
                            Процесс / Служба авторизации
                          </div>
                          <div className="mt-1 flex items-center gap-2 font-medium text-zinc-100">
                            <Wifi className="h-3.5 w-3.5 text-emerald-400" />
                            {service}
                          </div>
                        </div>

                        <div className="rounded-md border border-zinc-800 bg-zinc-950 p-3">
                          <div className="text-[10px] uppercase text-zinc-500">
                            Рекомендуемое действие
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-emerald-300">
                            <Terminal className="h-3.5 w-3.5 shrink-0" />
                            klist purge + Unlock-ADAccount
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 2. INTERACTIVE ORG CHART (Интерактивное дерево оргструктуры) */}
        {subTab === 'orgchart' && (
          <div className="space-y-4">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-100">
                  Интерактивная Оргструктура компании (Active Directory Manager Hierarchy)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Перетащите карточку любого сотрудника мышью на другого руководителя, чтобы мгновенно изменить иерархию подчинения (<code className="text-emerald-400">Set-ADUser -Manager</code>).
                </p>
              </div>
              <div className="relative w-72">
                <Search className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  placeholder="Поиск по ФИО, должности, отделу..."
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 pl-9 pr-3 py-2 text-xs text-zinc-100"
                />
              </div>
            </div>

            <div className="space-y-4">
              {rootManagers.map((root) => renderOrgNode(root, 0))}
            </div>
          </div>
        )}

        {/* 3. ACCESS PATH GRAPH (BloodHound-style Effective Access) */}
        {subTab === 'graph' && selectedGraphUser && (
          <div className="space-y-5">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-zinc-100">
                  Граф эффективных прав доступа и делегирования ACL (Access Path Visualizer)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Наглядная цепочка наследования прав: от учётной записи через группы безопасности к целевым серверам и подразделениям OU.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-zinc-400">Анализируемый объект:</span>
                <select
                  value={graphUserId}
                  onChange={(e) => setGraphUserId(e.target.value)}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 font-medium"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.samAccountName}) — {u.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {/* Column 1: User Node */}
              <div className="rounded-lg border border-emerald-500/30 bg-zinc-900/90 p-5 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  1. Субъект доступа (AD User)
                </div>
                <div className="text-base font-bold text-zinc-100">
                  {selectedGraphUser.displayName}
                </div>
                <div className="font-mono text-xs text-zinc-400">
                  {selectedGraphUser.userPrincipalName}
                </div>
                <div className="text-xs text-zinc-300">
                  {selectedGraphUser.title} • {selectedGraphUser.department}
                </div>
                <div className="pt-2">
                  <button
                    onClick={() => onOpenUserWindow(selectedGraphUser)}
                    className="w-full rounded-md bg-zinc-800 hover:bg-zinc-700 py-2 text-xs font-medium text-zinc-100 transition"
                  >
                    Открыть свойства AD
                  </button>
                </div>
              </div>

              {/* Column 2: Security Groups */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                  2. Членство в группах RBAC ({userGroupObjects.length})
                </div>
                <div className="space-y-2">
                  {userGroupObjects.map((g) => (
                    <div
                      key={g.id}
                      className="rounded-md border border-zinc-800 bg-zinc-950 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-100">
                          {g.samAccountName}
                        </span>
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                          {g.groupScope}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400">{g.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 3: Effective Target Permissions & Servers */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5 space-y-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  3. Эффективные права ACL и доступ к узлам
                </div>
                <div className="space-y-2">
                  {matchedAcls.map((a) => (
                    <div
                      key={a.id}
                      className="rounded-md border border-emerald-500/30 bg-zinc-950 p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-300">
                          {a.accessControlType}: {a.activeDirectoryRights}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-zinc-400">
                        Цель: {a.targetDn}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        Через группу: {a.identityReference}
                      </div>
                    </div>
                  ))}
                  {computers
                    .filter((c) =>
                      c.loggedOnUser
                        .toLowerCase()
                        .includes(selectedGraphUser.samAccountName.toLowerCase())
                    )
                    .map((c) => (
                      <div
                        key={c.id}
                        className="rounded-md border border-zinc-800 bg-zinc-950 p-3 flex items-center justify-between"
                      >
                        <div>
                          <div className="text-xs font-bold text-zinc-100">
                            Активная сессия на {c.name}
                          </div>
                          <div className="font-mono text-[11px] text-zinc-400">
                            {c.ipAddress} • {c.operatingSystem}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-emerald-400" />
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. FINE-GRAINED PASSWORD POLICIES (PSO) */}
        {subTab === 'pso' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-5 space-y-3.5 h-fit">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-zinc-100">
                  Создать парольную политику PSO
                </h3>
              </div>
              <p className="text-xs text-zinc-400">
                Гранулярные политики паролей (<code className="text-emerald-400">msDS-PasswordSettings</code>) позволяют задавать разные требования длины пароля и блокировки для разных групп AD.
              </p>

              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-zinc-400 mb-1">Название PSO:</label>
                  <input
                    value={newPso.name}
                    onChange={(e) => setNewPso({ ...newPso, name: e.target.value })}
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-zinc-100"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-400 mb-1">
                      Мин. длина пароля:
                    </label>
                    <input
                      type="number"
                      value={newPso.minPasswordLength}
                      onChange={(e) =>
                        setNewPso({
                          ...newPso,
                          minPasswordLength: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">
                      Приоритет (Precedence):
                    </label>
                    <input
                      type="number"
                      value={newPso.precedence}
                      onChange={(e) =>
                        setNewPso({
                          ...newPso,
                          precedence: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-zinc-400 mb-1">
                      Срок действия (дней):
                    </label>
                    <input
                      type="number"
                      value={newPso.maxPasswordAgeDays}
                      onChange={(e) =>
                        setNewPso({
                          ...newPso,
                          maxPasswordAgeDays: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">
                      Порог блокировки:
                    </label>
                    <input
                      type="number"
                      value={newPso.lockoutThreshold}
                      onChange={(e) =>
                        setNewPso({
                          ...newPso,
                          lockoutThreshold: Number(e.target.value),
                        })
                      }
                      className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Целевая группа безопасности (Subject):
                  </label>
                  <select
                    value={newPso.appliesToGroup}
                    onChange={(e) =>
                      setNewPso({ ...newPso, appliesToGroup: e.target.value })
                    }
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
                  >
                    {groups.map((g) => (
                      <option key={g.id} value={g.samAccountName}>
                        {g.samAccountName}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => {
                    const created: PsoPolicy = {
                      id: `pso-${Date.now()}`,
                      name: newPso.name,
                      precedence: newPso.precedence,
                      minPasswordLength: newPso.minPasswordLength,
                      maxPasswordAgeDays: newPso.maxPasswordAgeDays,
                      lockoutThreshold: newPso.lockoutThreshold,
                      lockoutDurationMins: newPso.lockoutDurationMins,
                      reversibleEncryption: false,
                      complexityEnabled: true,
                      appliesToGroups: [newPso.appliesToGroup],
                      description: newPso.description,
                    };
                    setPsoList((prev) => [...prev, created]);
                    const ps = `New-ADFineGrainedPasswordPolicy -Name "${created.name}" -Precedence ${created.precedence} -MinPasswordLength ${created.minPasswordLength} -MaxPasswordAge "${created.maxPasswordAgeDays}.00:00:00" -LockoutThreshold ${created.lockoutThreshold} -ComplexityEnabled $true\nAdd-ADFineGrainedPasswordPolicySubject -Identity "${created.name}" -Subjects "${newPso.appliesToGroup}"`;
                    onNotify(
                      `Гранулярная политика паролей «${created.name}» создана и привязана к группе ${newPso.appliesToGroup}`,
                      ps
                    );
                  }}
                  className="w-full flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-medium text-white transition"
                >
                  <Plus className="h-4 w-4" /> Создать политику PSO
                </button>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-3">
              {psoList
                .slice()
                .sort((a, b) => a.precedence - b.precedence)
                .map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/70 p-5 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="rounded-lg bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-1 font-mono text-xs font-bold text-emerald-400">
                          Приоритет #{p.precedence}
                        </span>
                        <h4 className="text-sm font-bold text-zinc-100 font-mono">
                          {p.name}
                        </h4>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.appliesToGroups.map((grp) => (
                          <span
                            key={grp}
                            className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-emerald-300"
                          >
                            Группа: {grp}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-400">{p.description}</p>
                    <div className="grid grid-cols-3 gap-2.5 text-xs">
                      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                        <div className="text-[10px] text-zinc-500">
                          Минимальная длина пароля
                        </div>
                        <div className="font-mono font-bold text-zinc-100 mt-0.5">
                          {p.minPasswordLength} символов
                        </div>
                      </div>
                      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                        <div className="text-[10px] text-zinc-500">
                          Максимальный срок пароля
                        </div>
                        <div className="font-mono font-bold text-zinc-100 mt-0.5">
                          {p.maxPasswordAgeDays} дней
                        </div>
                      </div>
                      <div className="rounded-md border border-zinc-800 bg-zinc-950 p-2.5">
                        <div className="text-[10px] text-zinc-500">
                          Порог блокировки (Lockout)
                        </div>
                        <div className="font-mono font-bold text-amber-300 mt-0.5">
                          {p.lockoutThreshold === 0
                            ? 'Не блокировать (SVC)'
                            : `${p.lockoutThreshold} ошибок (${p.lockoutDurationMins} мин)`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

