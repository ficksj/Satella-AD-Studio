import React, { useEffect, useState } from 'react';
import {
  Monitor,
  Server,
  Eye,
  EyeOff,
  Play,
  RotateCw,
  PowerOff,
  Terminal,
  Activity,
  Cog,
  AlertTriangle,
  Copy,
  CheckSquare,
  Square,
  ScreenShare,
  XCircle,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api';
import type {
  AdComputer,
  RemoteEventLogEntry,
  RemoteProcessInfo,
  RemoteServiceInfo,
  ScriptExecutionResult,
} from '../types';

interface Props {
  computers: AdComputer[];
  selectedComputer: AdComputer | null;
  onSelectComputer: (comp: AdComputer | null) => void;
  onLaunchRemoteSession: (
    computerId: string,
    sessionId: number,
    protocol: string,
    control: boolean
  ) => void;
  onPowerAction: (computerId: string, action: string, reason: string) => void;
  onNotify: (msg: string, ps?: string) => void;
}

export const ComputersView: React.FC<Props> = ({
  computers,
  selectedComputer,
  onSelectComputer,
  onLaunchRemoteSession,
  onPowerAction,
  onNotify,
}) => {
  const [activeHost, setActiveHost] = useState<AdComputer | null>(
    selectedComputer || computers[0] || null
  );
  const [hostTab, setHostTab] = useState<
    'sessions' | 'laps' | 'processes' | 'services' | 'events' | 'deploy'
  >('sessions');
  const [revealLaps, setRevealLaps] = useState<Record<string, boolean>>({});
  const [lapsDays, setLapsDays] = useState<number>(14);

  const [processes, setProcesses] = useState<RemoteProcessInfo[]>([]);
  const [services, setServices] = useState<RemoteServiceInfo[]>([]);
  const [events, setEvents] = useState<RemoteEventLogEntry[]>([]);

  // Mass Script Deploy State
  const [checkedHostIds, setCheckedHostIds] = useState<string[]>(
    computers.filter((c) => c.isOnline).map((c) => c.id)
  );
  const [scriptName, setScriptName] = useState(
    'Очистка кэша DNS и перезапуск агента 1С / Kaspersky'
  );
  const [scriptCode, setScriptCode] = useState(
    `Clear-DnsClientCache\ngpupdate /force\nGet-Process -Name "1cv8*" -ErrorAction SilentlyContinue | Stop-Process -Force\nWrite-Output "Host maintenance completed on $env:COMPUTERNAME"`
  );
  const [deployResults, setDeployResults] = useState<ScriptExecutionResult[]>([]);
  const [deployRunning, setDeployRunning] = useState(false);

  useEffect(() => {
    if (selectedComputer) {
      const updated = computers.find((c) => c.id === selectedComputer.id);
      setActiveHost(updated || selectedComputer);
    } else if (activeHost) {
      const updated = computers.find((c) => c.id === activeHost.id);
      if (updated) setActiveHost(updated);
    } else if (computers.length > 0) {
      setActiveHost(computers[0]);
    }
  }, [selectedComputer, computers]);

  useEffect(() => {
    if (!activeHost) return;
    api.getRemoteProcesses(activeHost.id).then(setProcesses).catch(() => {});
    api.getRemoteServices(activeHost.id).then(setServices).catch(() => {});
    api.getRemoteEvents(activeHost.id).then(setEvents).catch(() => {});
  }, [activeHost?.id]);

  const handleRotateLaps = async (compId: string, days = 14) => {
    const res = await api.rotateLaps(compId, days);
    if (res.data && activeHost?.id === compId) {
      setActiveHost(res.data);
    }
    setRevealLaps((p) => ({ ...p, [compId]: true }));
    onNotify(res.message, res.generatedPowerShell);
  };

  const handleKillProcess = async (pid: number) => {
    if (!activeHost) return;
    const res = await api.killRemoteProcess(activeHost.id, pid);
    setProcesses((prev) => prev.filter((p) => p.pid !== pid));
    onNotify(res.message, res.generatedPowerShell);
  };

  const handleServiceAction = async (serviceName: string, action: string) => {
    if (!activeHost) return;
    const res = await api.toggleRemoteService(activeHost.id, serviceName, action);
    if (res.data) {
      setServices((prev) =>
        prev.map((s) => (s.name === serviceName ? res.data! : s))
      );
    }
    onNotify(res.message, res.generatedPowerShell);
  };

  const handleRunDeploy = async () => {
    if (checkedHostIds.length === 0) return;
    setDeployRunning(true);
    try {
      const res = await api.deployScript(checkedHostIds, scriptName, scriptCode);
      setDeployResults(res.data || []);
      onNotify(res.message, res.generatedPowerShell);
    } finally {
      setDeployRunning(false);
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left List of Computers */}
      <div className="w-[430px] shrink-0 border-r border-zinc-800 bg-zinc-950/50 flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              Компьютеры и серверы домена ({computers.length})
            </h3>
            <p className="text-[11px] text-zinc-500">
              Живой мониторинг сессий, Windows LAPS, WinRM и Shadow RDP
            </p>
          </div>
          <button
            onClick={() => setHostTab('laps')}
            className="flex items-center gap-1 rounded-lg bg-amber-500/15 border border-amber-500/30 px-2.5 py-1.5 text-[11px] font-medium text-amber-300 hover:bg-amber-500/25"
          >
            <KeyRound className="h-3.5 w-3.5" /> Консоль LAPS
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60">
          {computers.map((c) => {
            const isSelected = activeHost?.id === c.id;
            const isChecked = checkedHostIds.includes(c.id);
            const isServer = c.name.startsWith('SRV');

            return (
              <div
                key={c.id}
                onClick={() => {
                  setActiveHost(c);
                  onSelectComputer(c);
                }}
                className={`p-3.5 cursor-pointer transition ${
                  isSelected
                    ? 'bg-indigo-500/10 border-l-2 border-l-indigo-500'
                    : 'hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCheckedHostIds((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((x) => x !== c.id)
                            : [...prev, c.id]
                        );
                      }}
                      className="text-zinc-500 hover:text-indigo-400"
                    >
                      {isChecked ? (
                        <CheckSquare className="h-3.5 w-3.5 text-indigo-400" />
                      ) : (
                        <Square className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {isServer ? (
                      <Server className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Monitor className="h-4 w-4 text-cyan-400" />
                    )}
                    <span className="font-mono text-xs font-semibold text-zinc-100">
                      {c.name}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-400">
                      {c.ipAddress}
                    </span>
                  </div>

                  {c.isOnline ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {c.pingLatencyMs} ms
                    </span>
                  ) : (
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                      Offline
                    </span>
                  )}
                </div>

                <div className="mt-1.5 text-[11px] text-zinc-400 truncate">
                  {c.description}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-500">
                  <span>{c.operatingSystem}</span>
                  <span className="font-mono text-zinc-300">
                    {c.loggedOnUser || 'Нет активной сессии'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right Host Control Center */}
      {activeHost && (
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950/60 px-6 py-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-mono text-base font-bold text-zinc-100">
                  {activeHost.dnsHostName}
                </h2>
                <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-cyan-300">
                  {activeHost.ipAddress}
                </span>
                <span className="font-mono text-xs text-zinc-500">
                  MAC: {activeHost.macAddress} • Uptime: {activeHost.uptime}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                {activeHost.description} • {activeHost.distinguishedName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* LAPS Password Pill */}
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs">
                <span className="text-amber-300 font-medium">LAPS:</span>
                <span className="font-mono text-zinc-100">
                  {revealLaps[activeHost.id]
                    ? activeHost.lapsPassword
                    : '••••••••••••'}
                </span>
                <button
                  onClick={() =>
                    setRevealLaps((p) => ({
                      ...p,
                      [activeHost.id]: !p[activeHost.id],
                    }))
                  }
                  title="Показать / скрыть пароль LAPS"
                  className="text-zinc-400 hover:text-zinc-100"
                >
                  {revealLaps[activeHost.id] ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(activeHost.lapsPassword);
                    onNotify(
                      `Пароль локального администратора LAPS для ${activeHost.name} скопирован в буфер обмена`
                    );
                  }}
                  title="Копировать пароль LAPS"
                  className="text-amber-300 hover:text-amber-100"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleRotateLaps(activeHost.id, 14)}
                  title="Принудительно ротировать пароль LAPS сейчас"
                  className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200 hover:bg-amber-500/30"
                >
                  Ротировать
                </button>
              </div>

              <button
                onClick={() =>
                  onPowerAction(
                    activeHost.id,
                    'reboot',
                    'Плановая перезагрузка администратором Satella AD'
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
              >
                <RotateCw className="h-3.5 w-3.5 text-amber-400" /> Перезагрузить
              </button>
              <button
                onClick={() =>
                  onPowerAction(
                    activeHost.id,
                    'shutdown',
                    'Выключение хоста администратором'
                  )
                }
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs text-rose-300 hover:bg-rose-500/20"
              >
                <PowerOff className="h-3.5 w-3.5" /> Выключить
              </button>
            </div>
          </div>

          {/* Sub-navigation */}
          <div className="flex border-b border-zinc-800 bg-zinc-950 px-6 gap-5 text-xs overflow-x-auto">
            {[
              {
                id: 'sessions',
                label: `Shadow RDP (${activeHost.activeSessions.length})`,
                icon: ScreenShare,
              },
              {
                id: 'laps',
                label: 'Управление LAPS (Локальный админ)',
                icon: KeyRound,
              },
              {
                id: 'processes',
                label: `Процессы (${processes.length})`,
                icon: Activity,
              },
              {
                id: 'services',
                label: `Службы (${services.length})`,
                icon: Cog,
              },
              {
                id: 'events',
                label: `Event Log (${events.length})`,
                icon: AlertTriangle,
              },
              {
                id: 'deploy',
                label: `Массовый скрипт (${checkedHostIds.length} ПК)`,
                icon: Terminal,
              },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setHostTab(t.id as typeof hostTab)}
                  className={`flex items-center gap-2 py-3 font-medium border-b-2 whitespace-nowrap transition ${
                    hostTab === t.id
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {hostTab === 'sessions' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-950/15 p-4">
                  <div>
                    <h4 className="text-xs font-semibold text-indigo-200">
                      Прямое и теневое подключение (Shadow RDP без выбивания
                      пользователя)
                    </h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Подключайтесь к рабочему столу сотрудника в режиме
                      просмотра или совместного управления в 1 клик через
                      нативный <code className="text-indigo-300">mstsc.exe /shadow</code>
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      onLaunchRemoteSession(activeHost.id, 0, 'rdp', true)
                    }
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500"
                  >
                    Открыть обычный RDP (mstsc)
                  </button>
                </div>

                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                      <tr>
                        <th className="py-2.5 px-4">ID сессии</th>
                        <th className="py-2.5 px-4">Пользователь</th>
                        <th className="py-2.5 px-4">Статус</th>
                        <th className="py-2.5 px-4">Клиент / IP</th>
                        <th className="py-2.5 px-4 text-right">
                          Действия Shadow RDP
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {activeHost.activeSessions.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-8 text-center text-zinc-500"
                          >
                            На хосте нет активных пользовательских сессий
                          </td>
                        </tr>
                      ) : (
                        activeHost.activeSessions.map((s) => (
                          <tr key={s.sessionId} className="hover:bg-zinc-900/40">
                            <td className="py-3 px-4 font-mono text-zinc-300">
                              #{s.sessionId}
                            </td>
                            <td className="py-3 px-4 font-semibold text-zinc-100">
                              {s.username}
                            </td>
                            <td className="py-3 px-4">
                              <span className="rounded bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-400">
                                {s.state}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-400">
                              {s.clientName} ({s.clientIp})
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <button
                                onClick={() =>
                                  onLaunchRemoteSession(
                                    activeHost.id,
                                    s.sessionId,
                                    'shadow',
                                    false
                                  )
                                }
                                className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-700"
                              >
                                👁 Shadow (Просмотр)
                              </button>
                              <button
                                onClick={() =>
                                  onLaunchRemoteSession(
                                    activeHost.id,
                                    s.sessionId,
                                    'shadow',
                                    true
                                  )
                                }
                                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
                              >
                                🎮 Shadow (Управление)
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {hostTab === 'laps' && (
              <div className="space-y-6">
                {/* Active Host LAPS Card */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-100">
                          Windows LAPS / Legacy LAPS — {activeHost.name}
                        </h3>
                        <p className="text-xs text-zinc-400">
                          Атрибуты AD:{' '}
                          <code className="text-amber-300">msLAPS-Password</code> /{' '}
                          <code className="text-amber-300">ms-Mcs-AdmPwd</code>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-zinc-400">Срок нового пароля:</span>
                      <select
                        value={lapsDays}
                        onChange={(e) => setLapsDays(Number(e.target.value))}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                      >
                        <option value={1}>1 день (Экстренный доступ)</option>
                        <option value={7}>7 дней</option>
                        <option value={14}>14 дней (Стандарт GPO)</option>
                        <option value={30}>30 дней</option>
                      </select>
                      <button
                        onClick={() => handleRotateLaps(activeHost.id, lapsDays)}
                        className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 font-semibold text-zinc-950 hover:bg-amber-400 transition"
                      >
                        <RotateCw className="h-3.5 w-3.5" /> Принудительно
                        ротировать пароль LAPS
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 text-xs">
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                      <div className="text-zinc-500">
                        Учётная запись локального админа
                      </div>
                      <div className="mt-1 font-mono text-sm font-semibold text-zinc-100">
                        .\Administrator
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                      <div className="text-zinc-500">
                        Текущий пароль в Active Directory
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <span className="font-mono text-sm font-bold text-emerald-400">
                          {revealLaps[activeHost.id]
                            ? activeHost.lapsPassword
                            : '••••••••••••••••'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              setRevealLaps((p) => ({
                                ...p,
                                [activeHost.id]: !p[activeHost.id],
                              }))
                            }
                            className="text-zinc-400 hover:text-zinc-100"
                          >
                            {revealLaps[activeHost.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                activeHost.lapsPassword
                              );
                              onNotify(
                                `Пароль LAPS для ${activeHost.name} скопирован`
                              );
                            }}
                            className="text-amber-300 hover:text-amber-100"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3.5">
                      <div className="text-zinc-500">
                        Ключ восстановления BitLocker (msFVE)
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-emerald-300 truncate">
                          {activeHost.bitLockerKeys && activeHost.bitLockerKeys.length > 0
                            ? `${activeHost.bitLockerKeys[0].keyId}: ${
                                revealLaps[activeHost.id]
                                  ? activeHost.bitLockerKeys[0].recoveryPassword
                                  : '••••••-••••••-••••••-••••••'
                              }`
                            : 'TPM 2.0 XTS-AES 256'}
                        </span>
                        {activeHost.bitLockerKeys && activeHost.bitLockerKeys.length > 0 && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(
                                activeHost.bitLockerKeys![0].recoveryPassword
                              );
                              onNotify(
                                `48-значный ключ BitLocker (${activeHost.bitLockerKeys![0].keyId}) для ${activeHost.name} скопирован`
                              );
                            }}
                            title="Скопировать 48-значный ключ BitLocker"
                            className="text-emerald-400 hover:text-emerald-200 shrink-0"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* All Computers LAPS Matrix */}
                <div className="rounded-xl border border-zinc-800 overflow-hidden">
                  <div className="border-b border-zinc-800 bg-zinc-900/60 px-4 py-3 text-xs font-semibold text-zinc-200">
                    Матрица паролей локального администратора (LAPS) по всем
                    хостам домена
                  </div>
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                      <tr>
                        <th className="py-2.5 px-4">Хост</th>
                        <th className="py-2.5 px-4">Подразделение (OU)</th>
                        <th className="py-2.5 px-4">Пароль LAPS</th>
                        <th className="py-2.5 px-4">Действителен до</th>
                        <th className="py-2.5 px-4 text-right">Управление</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/60">
                      {computers.map((c) => (
                        <tr key={c.id} className="hover:bg-zinc-900/40">
                          <td className="py-2.5 px-4 font-mono font-semibold text-zinc-100">
                            {c.name}{' '}
                            <span className="text-zinc-500 font-normal">
                              ({c.ipAddress})
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-[11px] text-zinc-400">
                            {c.ouDn.split(',')[0]}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-emerald-300">
                            {revealLaps[c.id] ? c.lapsPassword : '••••••••••••'}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-zinc-400">
                            {c.lapsExpiration
                              ? new Date(c.lapsExpiration).toLocaleDateString()
                              : '—'}
                          </td>
                          <td className="py-2.5 px-4 text-right space-x-2">
                            <button
                              onClick={() =>
                                setRevealLaps((p) => ({
                                  ...p,
                                  [c.id]: !p[c.id],
                                }))
                              }
                              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                            >
                              {revealLaps[c.id] ? 'Скрыть' : 'Показать'}
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(c.lapsPassword);
                                onNotify(`Пароль LAPS (${c.name}) скопирован`);
                              }}
                              className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                            >
                              Копировать
                            </button>
                            <button
                              onClick={() => handleRotateLaps(c.id, lapsDays)}
                              className="rounded bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 text-[11px] font-medium text-amber-300 hover:bg-amber-500/30"
                            >
                              Ротировать
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {hostTab === 'processes' && (
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                    <tr>
                      <th className="py-2.5 px-4">PID</th>
                      <th className="py-2.5 px-4">Имя процесса</th>
                      <th className="py-2.5 px-4">Заголовок окна</th>
                      <th className="py-2.5 px-4">Пользователь</th>
                      <th className="py-2.5 px-4">CPU / RAM</th>
                      <th className="py-2.5 px-4 text-right">Управление</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {processes.map((p) => (
                      <tr key={p.pid} className="hover:bg-zinc-900/40">
                        <td className="py-2.5 px-4 font-mono text-zinc-400">
                          {p.pid}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-semibold text-zinc-100">
                          {p.name}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-300">
                          {p.windowTitle}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-zinc-400">
                          {p.username}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-cyan-300">
                          {p.cpuPercent}% • {p.memoryMb} MB
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            onClick={() => handleKillProcess(p.pid)}
                            className="inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
                          >
                            <XCircle className="h-3 w-3" /> Завершить (Kill)
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {hostTab === 'services' && (
              <div className="rounded-xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                    <tr>
                      <th className="py-2.5 px-4">Служба</th>
                      <th className="py-2.5 px-4">Описание</th>
                      <th className="py-2.5 px-4">Тип запуска</th>
                      <th className="py-2.5 px-4">Статус</th>
                      <th className="py-2.5 px-4 text-right">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {services.map((s) => (
                      <tr key={s.name} className="hover:bg-zinc-900/40">
                        <td className="py-2.5 px-4 font-mono font-semibold text-zinc-100">
                          {s.name}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-300">
                          {s.displayName}
                        </td>
                        <td className="py-2.5 px-4 text-zinc-400">
                          {s.startType}
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`rounded px-2 py-0.5 text-[11px] ${
                              s.status === 'Running'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right space-x-1.5">
                          <button
                            onClick={() => handleServiceAction(s.name, 'restart')}
                            className="rounded border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                          >
                            Перезапустить
                          </button>
                          <button
                            onClick={() => handleServiceAction(s.name, 'stop')}
                            className="rounded border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
                          >
                            Остановить
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {hostTab === 'events' && (
              <div className="space-y-3">
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            ev.level === 'Error'
                              ? 'bg-rose-500/20 text-rose-400'
                              : ev.level === 'Warning'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-indigo-500/20 text-indigo-300'
                          }`}
                        >
                          {ev.level} • Event ID {ev.eventId}
                        </span>
                        <span className="font-mono text-xs text-zinc-300">
                          {ev.logName} / {ev.source}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-zinc-500">
                        {new Date(ev.timeCreated).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-zinc-200 font-mono">
                      {ev.message}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {hostTab === 'deploy' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
                      Массовое выполнение PowerShell через WinRM на выбранных
                      компьютерах ({checkedHostIds.length} шт.)
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 mb-1">
                        Название задачи / пакета
                      </label>
                      <input
                        value={scriptName}
                        onChange={(e) => setScriptName(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100"
                      />
                    </div>
                    <div>
                      <label className="block text-zinc-400 mb-1">
                        Код скрипта PowerShell (выполняется в сессии SYSTEM /
                        Domain Admin)
                      </label>
                      <textarea
                        rows={5}
                        value={scriptCode}
                        onChange={(e) => setScriptCode(e.target.value)}
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 p-3 font-mono text-xs text-emerald-300"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      disabled={deployRunning}
                      onClick={handleRunDeploy}
                      className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                      {deployRunning
                        ? 'Выполнение на хостах...'
                        : `Запустить на ${checkedHostIds.length} хостах`}
                    </button>
                  </div>
                </div>

                {deployResults.length > 0 && (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
                    <div className="text-xs font-semibold text-zinc-300">
                      Результаты выполнения по хостам:
                    </div>
                    {deployResults.map((r) => (
                      <div
                        key={r.computerName}
                        className="flex items-center justify-between rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3 py-2 font-mono text-xs"
                      >
                        <span
                          className={
                            r.success ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          {r.output}
                        </span>
                        <span className="text-zinc-500">{r.durationMs} ms</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
