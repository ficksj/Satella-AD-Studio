import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Server,
  KeyRound,
  FileSpreadsheet,
  Wrench,
  RefreshCw,
  Copy,
  Eye,
  EyeOff,
  Plus,
  XCircle,
  CheckCircle2,
  ArrowRightLeft,
  Download,
  FileCode2,
  Search,
  Sparkles,
} from 'lucide-react';
import { api } from '../api';
import type {
  AdComputer,
  AdGroup,
  AdUser,
  BitLockerRecord,
  DomainControllerStatus,
  JitAccessGrant,
  SecurityFinding,
} from '../types';

interface SecurityAndPamViewProps {
  users: AdUser[];
  groups: AdGroup[];
  computers: AdComputer[];
  domainName: string;
  onNotify: (msg: string, ps?: string) => void;
  onRefreshAll: () => void;
}

const FSMO_ROLES = [
  { id: 'PDCEmulator', label: 'PDC Emulator (Эмулятор PDC)', desc: 'Синхронизация времени, смена паролей, блокировки учёток' },
  { id: 'RIDMaster', label: 'RID Master (Мастер относительных ID)', desc: 'Выделение пулов SID для создания новых объектов домена' },
  { id: 'InfrastructureMaster', label: 'Infrastructure Master', desc: 'Обновление перекрёстных ссылок SID и DN между доменами' },
  { id: 'SchemaMaster', label: 'Schema Master (Мастер схемы леса)', desc: 'Управление классовой и атрибутной схемой леса AD' },
  { id: 'DomainNamingMaster', label: 'Domain Naming Master', desc: 'Добавление и удаление доменов и разделов в лесу AD' },
];

export const SecurityAndPamView: React.FC<SecurityAndPamViewProps> = ({
  users,
  groups,
  computers,
  domainName,
  onNotify,
  onRefreshAll,
}) => {
  const [subTab, setSubTab] = useState<'scanner' | 'jit' | 'dcs' | 'bitlocker' | 'reports'>('scanner');

  // Scanner state
  const [findings, setFindings] = useState<SecurityFinding[]>([]);
  const [scanning, setScanning] = useState(false);

  // JIT state
  const [jitGrants, setJitGrants] = useState<JitAccessGrant[]>([]);
  const [jitUserId, setJitUserId] = useState('');
  const [jitGroupId, setJitGroupId] = useState('');
  const [jitDuration, setJitDuration] = useState(60);
  const [jitReason, setJitReason] = useState('');
  const [nowTick, setNowTick] = useState(Date.now());

  // DCs state
  const [dcs, setDcs] = useState<DomainControllerStatus[]>([]);
  const [syncingDc, setSyncingDc] = useState(false);

  // BitLocker state
  const [bitlockerList, setBitlockerList] = useState<BitLockerRecord[]>([]);
  const [blSearch, setBlSearch] = useState('');
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});

  const loadAllModuleData = async () => {
    setScanning(true);
    try {
      const [fRes, jRes, dRes, bRes] = await Promise.all([
        api.runSecurityScan(),
        api.getJitGrants(),
        api.getDomainControllers(),
        api.getBitLockerKeys(),
      ]);
      setFindings(fRes);
      setJitGrants(jRes);
      setDcs(dRes);
      setBitlockerList(bRes);
      if (!jitUserId && users.length > 0) setJitUserId(users[0].id);
      if (!jitGroupId && groups.length > 0) setJitGroupId(groups[0].id);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    loadAllModuleData();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleFixFinding = async (id: string) => {
    const res = await api.fixSecurityFinding(id);
    if (res.success) {
      onNotify(res.message, res.generatedPowerShell);
      const updated = await api.runSecurityScan();
      setFindings(updated);
      onRefreshAll();
    }
  };

  const handleCreateJit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jitUserId || !jitGroupId) return;
    const res = await api.createJitGrant({
      userId: jitUserId,
      groupId: jitGroupId,
      durationMinutes: jitDuration,
      reason: jitReason || 'Временное повышение привилегий (JIT PAM)',
    });
    if (res.success) {
      onNotify(res.message, res.generatedPowerShell);
      setJitReason('');
      setJitGrants(await api.getJitGrants());
      onRefreshAll();
    }
  };

  const handleRevokeJit = async (id: string) => {
    const res = await api.revokeJitGrant(id);
    if (res.success) {
      onNotify(res.message, res.generatedPowerShell);
      setJitGrants(await api.getJitGrants());
      onRefreshAll();
    }
  };

  const handleTransferFsmo = async (roleName: string, targetDcName: string) => {
    const res = await api.transferFsmoRole(roleName, targetDcName);
    if (res.success && res.data) {
      setDcs(res.data);
      onNotify(res.message, res.generatedPowerShell);
    }
  };

  const handleForceSync = async () => {
    setSyncingDc(true);
    try {
      const res = await api.forceDcReplication();
      if (res.success && res.data) {
        setDcs(res.data);
        onNotify(res.message, res.generatedPowerShell);
      }
    } finally {
      setSyncingDc(false);
    }
  };

  const formatRemainingTime = (expiresAtIso: string) => {
    const diffMs = new Date(expiresAtIso).getTime() - nowTick;
    if (diffMs <= 0) return 'Истёк';
    const totalSec = Math.floor(diffMs / 1000);
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${hrs}ч ${mins}м ${secs}с`;
    return `${mins}м ${secs}с`;
  };

  const unfixedCount = findings.filter((f) => !f.isFixed).length;
  const securityScore = findings.length === 0 ? 100 : Math.round(((findings.length - unfixedCount) / findings.length) * 100);

  const filteredBitLocker = bitlockerList.filter((item) => {
    if (!blSearch.trim()) return true;
    const q = blSearch.trim().toLowerCase();
    return (
      item.computerName.toLowerCase().includes(q) ||
      item.keyId.toLowerCase().includes(q) ||
      item.recoveryPassword.toLowerCase().includes(q) ||
      item.loggedOnUser.toLowerCase().includes(q) ||
      item.ipAddress.toLowerCase().includes(q)
    );
  });

  // Report generators
  const downloadFile = (filename: string, content: string, mimeType: string) => {
    const blob = new Blob(['\uFEFF' + content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportUsersCsv = () => {
    const header = 'DisplayName;SamAccountName;Department;Title;Enabled;LockedOut;PasswordNeverExpires;GroupsCount\n';
    const rows = users
      .map(
        (u) =>
          `"${u.displayName}";"${u.samAccountName}";"${u.department}";"${u.title}";${u.enabled};${u.lockedOut};${u.passwordNeverExpires};${u.memberOf.length}`
      )
      .join('\n');
    downloadFile(`Satella_AD_Users_${domainName}.csv`, header + rows, 'text/csv;charset=utf-8');
    onNotify(`CSV-отчёт по пользователям (${users.length} записей) сохранён`);
  };

  const exportHostsBitLockerCsv = () => {
    const header = 'ComputerName;IPAddress;OS;Online;LapsPasswordSet;BitLockerKeyId;BitLockerRecoveryPassword\n';
    const rows = bitlockerList
      .map(
        (b) =>
          `"${b.computerName}";"${b.ipAddress}";"${b.operatingSystem}";true;true;"${b.keyId}";"${b.recoveryPassword}"`
      )
      .join('\n');
    downloadFile(`Satella_AD_BitLocker_LAPS_${domainName}.csv`, header + rows, 'text/csv;charset=utf-8');
    onNotify(`CSV-отчёт по хостам, LAPS и BitLocker (${bitlockerList.length} ПК) сохранён`);
  };

  const exportHtmlExecutiveReport = () => {
    const html = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <title>Отчёт ИБ Active Directory — ${domainName}</title>
  <style>
    body { background: #040906; color: #e2fbe8; font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 32px; }
    .card { background: #08120c; border: 1px solid #143821; border-radius: 14px; padding: 22px; margin-bottom: 24px; }
    h1, h2, h3 { color: #22c55e; margin-top: 0; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: bold; background: #0f2918; color: #4ade80; border: 1px solid #22c55e; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { border-bottom: 1px solid #143821; padding: 10px; text-align: left; }
    th { color: #4ade80; background: #0b1a10; }
    .footer { text-align: center; color: #4ade80; font-size: 12px; margin-top: 32px; opacity: 0.8; }
  </style>
</head>
<body>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h1>🐵 SATELLA AD STUDIO 2.0 — ОТЧЁТ АУДИТА ИБ</h1>
        <p>Домен: <strong>${domainName}</strong> | Дата формирования: <strong>${new Date().toLocaleString('ru-RU')}</strong></p>
      </div>
      <div class="badge">Сделано командой Crazy Monkeys</div>
    </div>
    <p>Индекс защищённости домена (Security Score): <strong style="font-size:22px;color:#4ade80;">${securityScore}%</strong></p>
    <p>Всего пользователей: <b>${users.length}</b> | Групп: <b>${groups.length}</b> | Компьютеров под защитой LAPS & BitLocker: <b>${computers.length}</b></p>
  </div>

  <div class="card">
    <h2>1. Результаты сканера уязвимостей Active Directory</h2>
    <table>
      <thead><tr><th>Критичность</th><th>Категория</th><th>Уязвимость</th><th>Объект</th><th>Статус</th></tr></thead>
      <tbody>
        ${findings
          .map(
            (f) =>
              `<tr><td><b>${f.severity}</b></td><td>${f.category}</td><td>${f.title}</td><td>${f.targetName}</td><td>${
                f.isFixed ? '✅ Устранено' : '⚠️ Требует внимания'
              }</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>2. Привилегированные группы и администраторы</h2>
    <table>
      <thead><tr><th>Группа</th><th>Категория / Область</th><th>Кол-во участников</th><th>Описание</th></tr></thead>
      <tbody>
        ${groups
          .map(
            (g) =>
              `<tr><td><b>${g.samAccountName}</b></td><td>${g.groupCategory} (${g.groupScope})</td><td>${g.members.length}</td><td>${g.description}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>3. Статус контроллеров домена и ролей FSMO</h2>
    <table>
      <thead><tr><th>Контроллер</th><th>IP-адрес</th><th>Сайт</th><th>Роли FSMO</th><th>Репликация</th></tr></thead>
      <tbody>
        ${dcs
          .map(
            (d) =>
              `<tr><td><b>${d.name}</b></td><td>${d.ipAddress}</td><td>${d.siteName}</td><td>${
                d.fsmoRoles.join(', ') || 'Реплицируемый DC'
              }</td><td>${d.replicationStatus}</td></tr>`
          )
          .join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">Сформировано автоматически в Satella AD Studio 2.0 • Сделано командой Crazy Monkeys</div>
</body>
</html>`;
    downloadFile(`Satella_Security_Audit_Report_${domainName}.html`, html, 'text/html;charset=utf-8');
    onNotify('Полный HTML-отчёт ИБ для руководства сформирован и скачан');
  };

  return (
    <div className="space-y-5">
      {/* Top Sub-Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSubTab('scanner')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              subTab === 'scanner'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Сканер уязвимостей AD</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/40 text-brand-300">
              {unfixedCount > 0 ? `${unfixedCount} угроз` : 'OK'}
            </span>
          </button>

          <button
            onClick={() => setSubTab('jit')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              subTab === 'jit'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Временный доступ (JIT / PAM)</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/40 text-brand-300">
              {jitGrants.filter((g) => g.isActive).length} актив.
            </span>
          </button>

          <button
            onClick={() => setSubTab('dcs')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              subTab === 'dcs'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Контроллеры домена и FSMO</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/40 text-brand-300">
              {dcs.length} DC
            </span>
          </button>

          <button
            onClick={() => setSubTab('bitlocker')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              subTab === 'bitlocker'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Ключи BitLocker</span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] bg-black/40 text-brand-300">
              {bitlockerList.length}
            </span>
          </button>

          <button
            onClick={() => setSubTab('reports')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
              subTab === 'reports'
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/25'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Генератор отчётов ИБ</span>
          </button>
        </div>

        <button
          onClick={loadAllModuleData}
          disabled={scanning}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-brand-400 ${scanning ? 'animate-spin' : ''}`} />
          <span>Обновить аудит</span>
        </button>
      </div>

      {/* 1. SECURITY SCANNER */}
      {subTab === 'scanner' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-400">Индекс защищённости AD</div>
                <div className="text-3xl font-bold text-brand-400 mt-1">{securityScore}%</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Оценка по 5 векторам атак MITRE</div>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-brand-400" />
              </div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400">Critical / Kerberoasting</div>
              <div className="text-2xl font-bold text-rose-400 mt-1">
                {findings.filter((f) => !f.isFixed && f.severity === 'Critical').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Сервисные учётки с SPN и вечным паролем</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400">High / Tier-0 Delegation</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {findings.filter((f) => !f.isFixed && f.severity === 'High').length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Постоянные права Domain Admins</div>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
              <div className="text-xs text-slate-400">Устранено уязвимостей</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {findings.filter((f) => f.isFixed).length} / {findings.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Автоматический Remediation в 1 клик</div>
            </div>
          </div>

          <div className="space-y-3">
            {findings.map((f) => (
              <div
                key={f.id}
                className={`rounded-2xl border p-4 transition ${
                  f.isFixed
                    ? 'bg-slate-900/40 border-slate-800/60 opacity-75'
                    : 'bg-slate-900/95 border-slate-800 hover:border-brand-500/40'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-1.5 max-w-3xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                          f.isFixed
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : f.severity === 'Critical'
                            ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                            : f.severity === 'High'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                        }`}
                      >
                        {f.isFixed ? 'ИСПРАВЛЕНО' : f.severity}
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[11px] bg-slate-800 text-slate-300 font-mono">
                        {f.category}
                      </span>
                      <span className="text-xs text-brand-400 font-mono">{f.targetName}</span>
                    </div>

                    <h3 className="text-sm font-semibold text-slate-100">{f.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{f.description}</p>
                    <div className="text-xs text-slate-300 bg-black/40 border border-slate-800/80 rounded-xl p-2.5 font-mono">
                      <span className="text-brand-400 font-semibold">PowerShell Remediation: </span>
                      {f.powerShellFix}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {f.isFixed ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-semibold text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Защищено
                      </span>
                    ) : (
                      <button
                        onClick={() => handleFixFinding(f.id)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/20 transition"
                      >
                        <Wrench className="w-4 h-4" />
                        <span>⚡ Исправить в 1 клик</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. JIT / PAM ACCESS */}
      {subTab === 'jit' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <form
            onSubmit={handleCreateJit}
            className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-brand-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Выдать временный доступ (JIT)</h3>
                <p className="text-[11px] text-slate-400">Автоматический отзыв прав по истечении таймера</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Сотрудник / Инженер</label>
              <select
                value={jitUserId}
                onChange={(e) => setJitUserId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.displayName} ({u.samAccountName}) — {u.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Целевая привилегированная группа</label>
              <select
                value={jitGroupId}
                onChange={(e) => setJitGroupId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.samAccountName} ({g.members.length} участн.)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Срок действия доступа (TTL)</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { mins: 15, label: '15 мин' },
                  { mins: 60, label: '1 час' },
                  { mins: 240, label: '4 часа' },
                  { mins: 1440, label: '24 часа' },
                ].map((opt) => (
                  <button
                    type="button"
                    key={opt.mins}
                    onClick={() => setJitDuration(opt.mins)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition ${
                      jitDuration === opt.mins
                        ? 'bg-brand-600/25 border-brand-500 text-brand-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Номер инцидента / Причина (ServiceDesk)</label>
              <input
                type="text"
                value={jitReason}
                onChange={(e) => setJitReason(e.target.value)}
                placeholder="Например: INC-5120 Обновление кластера SQL"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100"
              />
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/25 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Активировать временный доступ</span>
            </button>
          </form>

          <div className="lg:col-span-2 bg-slate-900/95 border border-slate-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Активные и недавние сессии JIT / PAM</h3>
                <p className="text-xs text-slate-400">
                  Контроль временного членства в привилегированных группах (Zero Standing Privileges)
                </p>
              </div>
            </div>

            <div className="space-y-2.5">
              {jitGrants.map((g) => {
                const rem = formatRemainingTime(g.expiresAt);
                const active = g.isActive && rem !== 'Истёк';
                return (
                  <div
                    key={g.id}
                    className={`p-4 rounded-xl border flex flex-wrap items-center justify-between gap-4 ${
                      active
                        ? 'bg-slate-950/90 border-brand-500/40'
                        : 'bg-slate-950/40 border-slate-800/60 opacity-65'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            active
                              ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {active ? `АКТИВЕН • ${rem}` : 'ОТОЗВАН / ИСТЁК'}
                        </span>
                        <span className="text-xs font-bold text-slate-100">{g.userDisplayName}</span>
                        <span className="text-xs text-slate-500">({g.userSam})</span>
                        <span className="text-xs text-brand-400 font-semibold">→ {g.groupName}</span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Основание: <span className="text-slate-200">{g.reason}</span> • Выдал: {g.grantedBy}
                      </div>
                    </div>

                    {active && (
                      <button
                        onClick={() => handleRevokeJit(g.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold transition"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Отозвать сейчас</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 3. DOMAIN CONTROLLERS & FSMO ROLES */}
      {subTab === 'dcs' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 rounded-2xl p-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Топология контроллеров домена и репликация Active Directory
              </h3>
              <p className="text-xs text-slate-400">
                Мониторинг состояния SYSVOL/Netlogon, Global Catalog и управление 5 ролями FSMO
              </p>
            </div>
            <button
              onClick={handleForceSync}
              disabled={syncingDc}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/20 transition"
            >
              <RefreshCw className={`w-4 h-4 ${syncingDc ? 'animate-spin' : ''}`} />
              <span>Форсировать репликацию AD (repadmin /syncall)</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dcs.map((dc) => (
              <div
                key={dc.name}
                className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
                      <Server className="w-6 h-6 text-brand-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-bold text-slate-100">{dc.name}</h4>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                          ONLINE • GC
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {dc.fqdn} • {dc.ipAddress}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-lg">
                    Сайт: {dc.siteName}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5">
                    <div className="text-[10px] text-slate-500 uppercase">Статус репликации</div>
                    <div className="text-xs font-semibold text-emerald-400 mt-0.5">{dc.replicationStatus}</div>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5">
                    <div className="text-[10px] text-slate-500 uppercase">SYSVOL / Netlogon</div>
                    <div className="text-xs font-semibold text-brand-300 mt-0.5">Ready & Shared</div>
                  </div>
                  <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5">
                    <div className="text-[10px] text-slate-500 uppercase">Удерживает ролей FSMO</div>
                    <div className="text-xs font-bold text-slate-100 mt-0.5">{dc.fsmoRoles.length} из 5</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {dc.fsmoRoles.length > 0 ? (
                    dc.fsmoRoles.map((r) => (
                      <span
                        key={r}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-brand-500/15 text-brand-300 border border-brand-500/30"
                      >
                        ★ {r}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">
                      Резервный контроллер домена (готовый принять роли FSMO)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* FSMO Role Transfer Matrix */}
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-brand-400" />
              <span>Управление 5 ролями FSMO (Operation Master Roles)</span>
            </h3>
            <div className="divide-y divide-slate-800/80">
              {FSMO_ROLES.map((role) => {
                const holder = dcs.find((d) => d.fsmoRoles.includes(role.id));
                return (
                  <div
                    key={role.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-4"
                  >
                    <div>
                      <div className="text-xs font-bold text-slate-100">{role.label}</div>
                      <div className="text-[11px] text-slate-400">{role.desc}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Текущий владелец:</span>
                      <span className="px-2.5 py-1 rounded-lg bg-brand-500/15 border border-brand-500/30 text-xs font-bold text-brand-300 font-mono">
                        {holder?.name || 'SRV-DC-01'}
                      </span>
                      {dcs
                        .filter((d) => d.name !== holder?.name)
                        .map((target) => (
                          <button
                            key={target.name}
                            onClick={() => handleTransferFsmo(role.id, target.name)}
                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white text-xs font-semibold border border-slate-700 transition"
                          >
                            Передать на {target.name}
                          </button>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 4. BITLOCKER RECOVERY KEYS */}
      {subTab === 'bitlocker' && (
        <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Хранилище ключей восстановления BitLocker в Active Directory (msFVE-RecoveryInformation)
              </h3>
              <p className="text-xs text-slate-400">
                Мгновенный поиск 48-значного ключа восстановления по первым 8 символам Key ID или имени ПК
              </p>
            </div>
            <div className="relative w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={blSearch}
                onChange={(e) => setBlSearch(e.target.value)}
                placeholder="Поиск по Key ID (напр. 10001EEF) или ПК..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-100"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] text-slate-400 uppercase">
                  <th className="py-2.5 px-3">Хост / Компьютер</th>
                  <th className="py-2.5 px-3">Текущий пользователь</th>
                  <th className="py-2.5 px-3">Идентификатор ключа (Key ID)</th>
                  <th className="py-2.5 px-3">48-значный ключ восстановления BitLocker</th>
                  <th className="py-2.5 px-3">Шифрование / Том</th>
                  <th className="py-2.5 px-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {filteredBitLocker.map((item) => {
                  const isShown = !!revealedKeys[item.keyId];
                  return (
                    <tr key={`${item.computerId}-${item.keyId}`} className="hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-semibold text-slate-100">
                        <div>{item.computerName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{item.ipAddress}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-300 font-mono">
                        {item.loggedOnUser || '—'}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-1 rounded-md bg-brand-500/15 border border-brand-500/30 text-brand-300 font-mono font-bold">
                          {item.keyId}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {isShown ? (
                          <span className="text-brand-400 font-bold tracking-wider">
                            {item.recoveryPassword}
                          </span>
                        ) : (
                          <span className="text-slate-500">
                            ••••••-••••••-••••••-••••••-••••••-••••••-••••••-••••••
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-400">
                        <div>{item.volumeType}</div>
                        <div className="text-[10px] text-slate-500">{item.cipherStrength}</div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() =>
                              setRevealedKeys((prev) => ({ ...prev, [item.keyId]: !prev[item.keyId] }))
                            }
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                            title={isShown ? 'Скрыть ключ' : 'Показать ключ'}
                          >
                            {isShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.recoveryPassword);
                              onNotify(
                                `Ключ восстановления BitLocker (${item.keyId}) для ${item.computerName} скопирован в буфер обмена`
                              );
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600 text-brand-300 hover:text-white border border-brand-500/30 transition"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>Копировать</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. COMPLIANCE & EXECUTIVE REPORTS */}
      {subTab === 'reports' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
                <FileCode2 className="w-6 h-6 text-brand-400" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Сводный HTML-отчёт ИБ для руководства (Executive Audit)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Красивый интерактивный HTML-документ в фирменном стиле Crazy Monkeys: индекс безопасности домена,
                найденные уязвимости, матрица привилегированных групп и статус контроллеров домена.
              </p>
            </div>
            <button
              onClick={exportHtmlExecutiveReport}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/25 transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>Скачать HTML-отчёт ИБ</span>
            </button>
          </div>

          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6 text-brand-400" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Реестр учётных записей и парольной политики (CSV / Excel)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Полная выгрузка всех пользователей домена ({users.length} чел.) с отделами, должностями, статусами
                блокировки, флагом PasswordNeverExpires и количеством групп.
              </p>
            </div>
            <button
              onClick={exportUsersCsv}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-brand-600 text-slate-100 hover:text-white border border-slate-700 text-xs font-semibold transition"
            >
              <Download className="w-4 h-4" />
              <span>Экспортировать пользователей (.CSV)</span>
            </button>
          </div>

          <div className="bg-slate-900/95 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-brand-400" />
              </div>
              <h3 className="text-base font-bold text-slate-100">
                Аудит защищённости рабочих станций, LAPS и BitLocker (CSV)
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Выгрузка всех серверов и рабочих станций ({computers.length} хостов), статус покрытия Windows LAPS
                и резервная таблица идентификаторов и ключей BitLocker.
              </p>
            </div>
            <button
              onClick={exportHostsBitLockerCsv}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-800 hover:bg-brand-600 text-slate-100 hover:text-white border border-slate-700 text-xs font-semibold transition"
            >
              <Download className="w-4 h-4" />
              <span>Экспортировать LAPS & BitLocker (.CSV)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
