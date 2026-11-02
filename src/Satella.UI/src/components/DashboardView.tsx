import React, { useState } from 'react';
import {
  Users,
  Lock,
  KeyRound,
  Monitor,
  ShieldAlert,
  RotateCcw,
  Unlock,
  Server,
  Plus,
  CheckCircle2,
  FolderTree,
  Trash2,
  ArrowUpRight,
  Database,
} from 'lucide-react';
import { api } from '../api';
import type { AdComputer, AdUser, DashboardStats, DomainProfile } from '../types';

interface Props {
  stats: DashboardStats | null;
  profiles: DomainProfile[];
  activeProfile: DomainProfile | null;
  onUnlockUser: (userId: string) => void;
  onSelectUser: (user: AdUser) => void;
  onSelectComputer: (comp: AdComputer) => void;
  onRollback: (auditId: string) => void;
  onSwitchProfile: (profileId: string) => void;
  onSaveProfile: (profile: DomainProfile, password?: string) => void;
  onResetSandbox: () => void;
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<Props> = ({
  stats,
  profiles,
  activeProfile,
  onUnlockUser,
  onSelectUser,
  onSelectComputer,
  onRollback,
  onSwitchProfile,
  onSaveProfile,
  onResetSandbox,
  onNavigate,
}) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfile, setNewProfile] = useState<DomainProfile>({
    id: '',
    name: 'Боевой контроллер домена AD',
    domainName: 'corp.company.local',
    dcHost: '10.0.0.10',
    port: 389,
    useSsl: false,
    useCurrentUserSso: true,
    username: '',
    isSandbox: false,
    isActive: false,
    lastConnectedAt: new Date().toISOString(),
  });
  const [plainPassword, setPlainPassword] = useState('');
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);

  const handleAutoDetect = async () => {
    setTestResult(null);
    const res = await api.detectDomain();
    if (res.data) {
      setNewProfile({
        ...newProfile,
        name: res.data.name,
        domainName: res.data.domainName,
        dcHost: res.data.dcHost,
        username: res.data.username,
        useCurrentUserSso: true,
        isSandbox: false,
      });
      setTestResult({ success: true, message: res.message });
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testProfile(newProfile, plainPassword);
      setTestResult({ success: res.success, message: res.message });
    } catch (e: unknown) {
      setTestResult({
        success: false,
        message: e instanceof Error ? e.message : 'Ошибка проверки соединения',
      });
    } finally {
      setTesting(false);
    }
  };

  if (!stats) {
    return (
      <div className="p-8 text-sm text-zinc-400">
        Загрузка телеметрии домена Active Directory...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Top Banner: Domain Connection & Mode */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300">
            <Server className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-zinc-100">
                {stats.domainName}
              </h2>
              <span
                className={`rounded px-2 py-0.5 text-[11px] font-medium tracking-wide ${
                  stats.isSandbox
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}
              >
                {stats.isSandbox ? 'SANDBOX' : 'LIVE AD'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              DC: {stats.dcHost} • Лес: {stats.forestMode} • OU: {stats.totalOus} • GPO: {stats.totalGpos}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <select
            value={activeProfile?.id || ''}
            onChange={(e) => onSwitchProfile(e.target.value)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 focus:border-zinc-500 focus:outline-none"
          >
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.isSandbox ? '[Sandbox] ' : '[Prod] '}
                {p.name} ({p.domainName})
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Подключить AD
          </button>

          {stats.isSandbox && (
            <button
              onClick={onResetSandbox}
              title="Вернуть эталонные данные песочницы corp.satella.local"
              className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Сброс демо-данных
            </button>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate('directory')}
          className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left hover:border-zinc-700 hover:bg-zinc-900/80 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Всего пользователей AD
            </span>
            <Users className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100 font-mono">
              {stats.totalUsers}
            </span>
            <span className="text-xs text-emerald-400 font-medium">
              {stats.activeUsers} активных
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>Групп безопасности: {stats.totalGroups}</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-zinc-400 transition" />
          </div>
        </button>

        <div className="rounded-lg border border-rose-900/40 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-400">
              Заблокированные учётки (Lockout)
            </span>
            <Lock className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-400 font-mono">
              {stats.lockedOutUsers}
            </span>
            <span className="text-xs text-rose-400/80">
              требуют разблокировки
            </span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            Превышен порог неверных паролей (badPwdCount ≥ 5)
          </div>
        </div>

        <div className="rounded-lg border border-amber-900/40 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-400">
              Истекает пароль (&lt; 7 дней)
            </span>
            <KeyRound className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-400 font-mono">
              {stats.expiringPasswordsCount}
            </span>
            <span className="text-xs text-amber-400/80">сотрудников</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500">
            Риск блокировки работы в ближайшие дни
          </div>
        </div>

        <button
          onClick={() => onNavigate('computers')}
          className="group rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left hover:border-zinc-700 hover:bg-zinc-900/80 transition"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Компьютеры и серверы в сети
            </span>
            <Monitor className="h-4 w-4 text-zinc-400 group-hover:text-emerald-400 transition" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-zinc-100 font-mono">
              {stats.onlineComputers} / {stats.totalComputers}
            </span>
            <span className="text-xs text-emerald-400 font-medium">Online (ICMP)</span>
          </div>
          <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>В Корзине AD: {stats.recycleBinCount} объ.</span>
            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 text-zinc-400 transition" />
          </div>
        </button>
      </div>

      {/* Main Two-Column Grid: Locked + Expiring on Left, Audit & Rollback on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 space-y-6">
          {/* Locked Out Users Action Card */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-900/80">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Заблокированные пользователи ({stats.lockedUsersList.length})
                </h3>
              </div>
              <span className="text-[11px] text-zinc-500">
                Быстрая разблокировка
              </span>
            </div>

            {stats.lockedUsersList.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 flex items-center justify-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Все учётные
                записи в порядке, заблокированных пользователей нет.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {stats.lockedUsersList.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-zinc-800/40 transition"
                  >
                    <div
                      onClick={() => onSelectUser(u)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-100 hover:text-emerald-400">
                          {u.displayName}
                        </span>
                        <span className="font-mono text-[11px] text-zinc-400">
                          ({u.samAccountName})
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {u.title} • {u.department} • Тел: {u.telephone || '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onUnlockUser(u.id)}
                        className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 transition"
                      >
                        <Unlock className="h-3.5 w-3.5" /> Разблокировать
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Expiring Passwords & Inactive Hosts */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-900/80">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                  Истекающие пароли в ближайшие 7 дней ({stats.expiringPasswordUsers.length})
                </h3>
              </div>
            </div>
            <div className="divide-y divide-zinc-800">
              {stats.expiringPasswordUsers.map((u) => {
                const daysLeft = u.passwordExpiresAt
                  ? Math.max(
                      0,
                      Math.ceil(
                        (new Date(u.passwordExpiresAt).getTime() - Date.now()) /
                          86400000
                      )
                    )
                  : 0;
                return (
                  <div
                    key={u.id}
                    onClick={() => onSelectUser(u)}
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-zinc-800/40 cursor-pointer transition"
                  >
                    <div>
                      <div className="text-xs font-medium text-zinc-200">
                        {u.displayName}{' '}
                        <span className="font-mono text-zinc-500">
                          ({u.samAccountName})
                        </span>
                      </div>
                      <div className="text-[11px] text-zinc-500">
                        {u.department} • {u.email}
                      </div>
                    </div>
                    <span className="rounded bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-medium text-amber-400">
                      Осталось {daysLeft} дн.
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Live Audit Stream with 1-Click Rollback */}
        <div className="lg:col-span-5 rounded-lg border border-zinc-800 bg-zinc-900/50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 bg-zinc-900/80">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4 text-zinc-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                Журнал действий и откат
              </h3>
            </div>
            <button
              onClick={() => onNavigate('audit')}
              className="text-[11px] text-zinc-400 hover:text-zinc-200 transition"
            >
              Весь журнал →
            </button>
          </div>

          <div className="divide-y divide-zinc-800 flex-1 overflow-y-auto max-h-[420px]">
            {stats.recentAuditLogs.map((log) => (
              <div key={log.id} className="p-3.5 hover:bg-zinc-800/30 transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                    {log.actionType}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {new Date(log.timestamp).toLocaleTimeString()} • {log.actor}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-zinc-300 leading-snug">
                  {log.summary}
                </p>
                {log.canRollback && (
                  <div className="mt-2 flex items-center justify-end">
                    {log.isRolledBack ? (
                      <span className="text-[11px] text-zinc-500 italic">
                        ✓ Изменение откачено
                      </span>
                    ) : (
                      <button
                        onClick={() => onRollback(log.id)}
                        className="flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/20"
                      >
                        <RotateCcw className="h-3 w-3" /> Откатить
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal: Connect Real Active Directory Domain */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  Подключение домена Active Directory (LDAP / LDAPS)
                </h3>
              </div>
              <button
                onClick={handleAutoDetect}
                className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-700 hover:text-white transition"
              >
                Автопоиск домена
              </button>
            </div>

            {testResult && (
              <div
                className={`rounded border p-3 text-xs ${
                  testResult.success
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                }`}
              >
                {testResult.message}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block text-zinc-400 mb-1">
                  Название профиля
                </label>
                <input
                  value={newProfile.name}
                  onChange={(e) =>
                    setNewProfile({ ...newProfile, name: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">
                  DNS-имя домена (FQDN)
                </label>
                <input
                  value={newProfile.domainName}
                  onChange={(e) =>
                    setNewProfile({ ...newProfile, domainName: e.target.value })
                  }
                  placeholder="corp.company.local"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">
                  IP или FQDN контроллера (DC)
                </label>
                <input
                  value={newProfile.dcHost}
                  onChange={(e) =>
                    setNewProfile({ ...newProfile, dcHost: e.target.value })
                  }
                  placeholder="10.0.0.10"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Порт LDAP/LDAPS</label>
                <input
                  type="number"
                  value={newProfile.port}
                  onChange={(e) =>
                    setNewProfile({
                      ...newProfile,
                      port: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input
                  type="checkbox"
                  checked={newProfile.useCurrentUserSso}
                  onChange={(e) =>
                    setNewProfile({
                      ...newProfile,
                      useCurrentUserSso: e.target.checked,
                    })
                  }
                />
                <span className="text-zinc-300">
                  Вход под текущей сессией Windows (SSO)
                </span>
              </div>

              {!newProfile.useCurrentUserSso && (
                <>
                  <div>
                    <label className="block text-zinc-400 mb-1">
                      Логин администратора (DOMAIN\user)
                    </label>
                    <input
                      value={newProfile.username}
                      onChange={(e) =>
                        setNewProfile({ ...newProfile, username: e.target.value })
                      }
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-400 mb-1">
                      Пароль (шифруется Windows DPAPI)
                    </label>
                    <input
                      type="password"
                      value={plainPassword}
                      onChange={(e) => setPlainPassword(e.target.value)}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
              <button
                disabled={testing}
                onClick={handleTestConnection}
                className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition"
              >
                {testing ? 'Проверка LDAP...' : 'Проверить подключение к DC'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowProfileModal(false)}
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 transition"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    onSaveProfile(newProfile, plainPassword);
                    setShowProfileModal(false);
                  }}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-500 transition"
                >
                  Сохранить и подключиться
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

