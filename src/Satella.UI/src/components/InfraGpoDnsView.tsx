import React, { useState } from 'react';
import {
  FileCog,
  ShieldCheck,
  Globe,
  Network,
  RefreshCw,
  Plus,
  Trash2,
  Lock,
  Pencil,
  Save,
  X,
} from 'lucide-react';
import type {
  AclRule,
  AdGpo,
  AdGroup,
  DhcpLease,
  DnsRecord,
  OuNode,
} from '../types';

interface Props {
  gpos: AdGpo[];
  ouTree: OuNode[];
  groups: AdGroup[];
  acls: AclRule[];
  dnsRecords: DnsRecord[];
  dhcpLeases: DhcpLease[];
  onSaveGpo: (gpo: AdGpo) => void;
  onDeleteGpo: (gpoId: string) => void;
  onToggleGpoLink: (
    gpoId: string,
    ouDn: string,
    enabled: boolean,
    enforced: boolean
  ) => void;
  onRunGpUpdate: (target: string) => void;
  onCreateAcl: (data: {
    targetDn: string;
    identityReference: string;
    accessControlType: string;
    activeDirectoryRights: string;
  }) => void;
  onCreateDns: (data: {
    zoneName: string;
    name: string;
    recordType: string;
    data: string;
    ttlSeconds: number;
  }) => void;
  onDeleteDns: (id: string) => void;
  onReserveDhcp: (id: string) => void;
}

const presetPolicyRules = [
  'Minimum Password Length: 14 characters (Complexity Enabled)',
  'Account Lockout Threshold: 5 invalid logon attempts (15 min reset)',
  'Windows LAPS: Backup Local Admin password to Active Directory (14 days)',
  'BitLocker Drive Encryption: Require TPM 2.0 + XTS-AES 256-bit',
  'Removable Storage Access: Deny Write Access to USB Mass Storage',
  'Remote Desktop Services: Allow Shadow RDP with user permission',
  'WinRM Service: Automatic Start & Allow Domain Firewall Exception',
  'Windows Defender Antivirus: Real-Time Protection & Cloud Block Enabled',
  'PowerShell Script Block Logging (Event ID 4104): Enabled',
];

export const InfraGpoDnsView: React.FC<Props> = ({
  gpos,
  ouTree,
  groups,
  acls,
  dnsRecords,
  dhcpLeases,
  onSaveGpo,
  onDeleteGpo,
  onToggleGpoLink,
  onRunGpUpdate,
  onCreateAcl,
  onCreateDns,
  onDeleteDns,
  onReserveDhcp,
}) => {
  const [subTab, setSubTab] = useState<'gpo' | 'acl' | 'dns' | 'dhcp'>('gpo');

  // GPO Creator / Editor Modal state
  const [editingGpo, setEditingGpo] = useState<AdGpo | null>(null);
  const [newSettingText, setNewSettingText] = useState('');
  const [linkOuToAdd, setLinkOuToAdd] = useState('');

  const [newDns, setNewDns] = useState({
    name: 'k8s-ingress',
    recordType: 'A',
    data: '10.20.2.90',
    ttlSeconds: 3600,
  });

  const [newAcl, setNewAcl] = useState({
    targetDn: 'OU=HQ Moscow,DC=corp,DC=satella,DC=local',
    identityReference: 'CORP\\Helpdesk-Operators',
    accessControlType: 'Allow',
    activeDirectoryRights: 'ResetPassword, WriteProperty (lockoutTime)',
  });

  const flattenOus = (nodes: OuNode[]): OuNode[] => {
    let list: OuNode[] = [];
    for (const n of nodes) {
      list.push(n);
      if (n.children?.length) list = list.concat(flattenOus(n.children));
    }
    return list;
  };
  const allOus = flattenOus(ouTree);

  const openNewGpoModal = () => {
    setNewSettingText('');
    setEditingGpo({
      id: '',
      name: 'Workstations-Hardening-Policy',
      guid: '',
      status: 'AllSettingsEnabled',
      description:
        'Корпоративная политика защиты рабочих станций, аудита PowerShell и настройки WinRM.',
      linkedOus: [
        {
          ouDn:
            allOus.find((o) => o.name === 'Workstations')?.distinguishedName ||
            allOus[0]?.distinguishedName ||
            'DC=corp,DC=satella,DC=local',
          enabled: true,
          enforced: false,
          order: 1,
        },
      ],
      securityFiltering: ['Authenticated Users', 'Domain Computers'],
      wmiFilter: 'None',
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      keySettingsSummary: [
        'WinRM Service: Automatic Start & Allow Domain Firewall Exception',
        'Windows Defender Antivirus: Real-Time Protection & Cloud Block Enabled',
      ],
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-6 py-3">
        <div className="flex items-center gap-2">
          {[
            {
              id: 'gpo',
              label: `Групповые политики GPO (${gpos.length})`,
              icon: FileCog,
            },
            {
              id: 'acl',
              label: `Делегирование прав ACL (${acls.length})`,
              icon: ShieldCheck,
            },
            {
              id: 'dns',
              label: `DNS Сервер (${dnsRecords.length})`,
              icon: Globe,
            },
            {
              id: 'dhcp',
              label: `DHCP Аренда и Резервации (${dhcpLeases.length})`,
              icon: Network,
            },
          ].map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setSubTab(t.id as typeof subTab)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                  subTab === t.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {subTab === 'gpo' && (
          <div className="flex items-center gap-2">
            <button
              onClick={openNewGpoModal}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition"
            >
              <Plus className="h-3.5 w-3.5" /> Создать политику GPO
            </button>
            <button
              onClick={() => onRunGpUpdate('corp.satella.local')}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/25"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Принудительный gpupdate
              /force
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {subTab === 'gpo' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {gpos.map((g) => (
              <div
                key={g.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileCog className="h-4 w-4 text-indigo-400" />
                        <h3 className="text-sm font-semibold text-zinc-100">
                          {g.name}
                        </h3>
                      </div>
                      <p className="font-mono text-[10px] text-zinc-500 mt-0.5">
                        GUID: {g.guid} • Статус: {g.status}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          setEditingGpo(JSON.parse(JSON.stringify(g)))
                        }
                        title="Редактировать параметры и привязки GPO"
                        className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                      >
                        <Pencil className="h-3 w-3" /> Редактировать
                      </button>
                      <button
                        onClick={() => onDeleteGpo(g.id)}
                        title="Удалить GPO"
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-500/15 hover:text-rose-400"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-zinc-300">{g.description}</p>

                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-3 space-y-1">
                    <div className="text-[11px] font-semibold text-zinc-400">
                      Активные правила и параметры политики (
                      {g.keySettingsSummary.length}):
                    </div>
                    {g.keySettingsSummary.map((s, idx) => (
                      <div
                        key={idx}
                        className="font-mono text-[11px] text-emerald-300"
                      >
                        • {s}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400">
                    <span>Привязки к подразделениям (GPLinks):</span>
                    <span className="font-mono text-[10px] text-indigo-300">
                      Фильтр: {g.securityFiltering.join(', ')}
                    </span>
                  </div>
                  {g.linkedOus.map((link) => (
                    <div
                      key={link.ouDn}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/70 px-3 py-2 text-xs"
                    >
                      <span className="font-mono text-[11px] text-zinc-200 truncate max-w-[260px]">
                        {link.ouDn}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            onToggleGpoLink(
                              g.id,
                              link.ouDn,
                              !link.enabled,
                              link.enforced
                            )
                          }
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            link.enabled
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          {link.enabled ? 'Link Enabled' : 'Disabled'}
                        </button>
                        <button
                          onClick={() =>
                            onToggleGpoLink(
                              g.id,
                              link.ouDn,
                              link.enabled,
                              !link.enforced
                            )
                          }
                          className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                            link.enforced
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}
                        >
                          {link.enforced ? 'Enforced: YES' : 'Enforced: NO'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {subTab === 'acl' && (
          <div className="space-y-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 flex flex-wrap items-end gap-3 text-xs">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-zinc-400 mb-1">
                  Целевое подразделение (Target DN)
                </label>
                <input
                  value={newAcl.targetDn}
                  onChange={(e) =>
                    setNewAcl({ ...newAcl, targetDn: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-zinc-200"
                />
              </div>
              <div className="w-56">
                <label className="block text-zinc-400 mb-1">
                  Субъект (Группа / Пользователь)
                </label>
                <input
                  value={newAcl.identityReference}
                  onChange={(e) =>
                    setNewAcl({ ...newAcl, identityReference: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-zinc-200"
                />
              </div>
              <div className="w-32">
                <label className="block text-zinc-400 mb-1">Тип</label>
                <select
                  value={newAcl.accessControlType}
                  onChange={(e) =>
                    setNewAcl({ ...newAcl, accessControlType: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-200"
                >
                  <option value="Allow">Allow</option>
                  <option value="Deny">Deny</option>
                </select>
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="block text-zinc-400 mb-1">
                  Делегируемые права AD
                </label>
                <input
                  value={newAcl.activeDirectoryRights}
                  onChange={(e) =>
                    setNewAcl({
                      ...newAcl,
                      activeDirectoryRights: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-zinc-200"
                />
              </div>
              <button
                onClick={() => onCreateAcl(newAcl)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 font-medium text-white hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" /> Делегировать
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                  <tr>
                    <th className="py-2.5 px-4">Тип</th>
                    <th className="py-2.5 px-4">Субъект (Identity)</th>
                    <th className="py-2.5 px-4">Объект / OU</th>
                    <th className="py-2.5 px-4">Права доступа (AD Rights)</th>
                    <th className="py-2.5 px-4">Наследование</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {acls.map((a) => (
                    <tr key={a.id} className="hover:bg-zinc-900/40">
                      <td className="py-3 px-4">
                        <span
                          className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                            a.accessControlType === 'Allow'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {a.accessControlType}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-zinc-100">
                        {a.identityReference}
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-400">
                        {a.targetDn}
                      </td>
                      <td className="py-3 px-4 font-mono text-indigo-300">
                        {a.activeDirectoryRights}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {a.inheritanceType}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {subTab === 'dns' && (
          <div className="space-y-5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 flex flex-wrap items-end gap-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Имя узла (Host)</label>
                <input
                  value={newDns.name}
                  onChange={(e) => setNewDns({ ...newDns, name: e.target.value })}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-zinc-100"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Тип записи</label>
                <select
                  value={newDns.recordType}
                  onChange={(e) =>
                    setNewDns({ ...newDns, recordType: e.target.value })
                  }
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-zinc-100"
                >
                  <option value="A">A (IPv4)</option>
                  <option value="CNAME">CNAME (Alias)</option>
                  <option value="TXT">TXT</option>
                  <option value="SRV">SRV</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-zinc-400 mb-1">
                  Значение (IP или FQDN)
                </label>
                <input
                  value={newDns.data}
                  onChange={(e) => setNewDns({ ...newDns, data: e.target.value })}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-emerald-300"
                />
              </div>
              <button
                onClick={() =>
                  onCreateDns({
                    zoneName: 'corp.satella.local',
                    ...newDns,
                  })
                }
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 font-medium text-white hover:bg-indigo-500"
              >
                <Plus className="h-3.5 w-3.5" /> Добавить запись DNS
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                  <tr>
                    <th className="py-2.5 px-4">Имя</th>
                    <th className="py-2.5 px-4">Зона</th>
                    <th className="py-2.5 px-4">Тип</th>
                    <th className="py-2.5 px-4">Данные (Значение)</th>
                    <th className="py-2.5 px-4">TTL / Тип</th>
                    <th className="py-2.5 px-4 text-right">Удалить</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-mono">
                  {dnsRecords.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-900/40">
                      <td className="py-2.5 px-4 font-semibold text-zinc-100">
                        {r.name}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400">{r.zoneName}</td>
                      <td className="py-2.5 px-4">
                        <span className="rounded bg-indigo-500/15 px-2 py-0.5 text-[11px] text-indigo-300">
                          {r.recordType}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-emerald-300">{r.data}</td>
                      <td className="py-2.5 px-4 text-zinc-500">
                        {r.ttlSeconds}s ({r.timestamp})
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <button
                          onClick={() => onDeleteDns(r.id)}
                          className="rounded p-1 text-zinc-500 hover:bg-rose-500/15 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {subTab === 'dhcp' && (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="py-2.5 px-4">IPv4 Адрес</th>
                  <th className="py-2.5 px-4">MAC Клиента</th>
                  <th className="py-2.5 px-4">Имя хоста</th>
                  <th className="py-2.5 px-4">Пул (Scope)</th>
                  <th className="py-2.5 px-4">Статус</th>
                  <th className="py-2.5 px-4 text-right">Резервация</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {dhcpLeases.map((l) => (
                  <tr key={l.id} className="hover:bg-zinc-900/40">
                    <td className="py-3 px-4 font-mono font-semibold text-cyan-300">
                      {l.ipAddress}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-300">
                      {l.clientMac}
                    </td>
                    <td className="py-3 px-4 font-mono text-zinc-100">
                      {l.hostName}
                    </td>
                    <td className="py-3 px-4 text-zinc-400">{l.scopeId}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                          l.state === 'Reserved'
                            ? 'bg-amber-500/20 text-amber-300'
                            : l.state === 'Active'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        {l.state}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {l.state !== 'Reserved' && (
                        <button
                          onClick={() => onReserveDhcp(l.id)}
                          className="inline-flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-[11px] text-indigo-300 hover:bg-indigo-500/25"
                        >
                          <Lock className="h-3 w-3" /> Закрепить IP за MAC
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: GPO Creator & Editor */}
      {editingGpo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <FileCog className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-zinc-100">
                  {editingGpo.id
                    ? `Редактор групповой политики (GPO): ${editingGpo.name}`
                    : 'Создание новой групповой политики (GPO)'}
                </h3>
              </div>
              <button
                onClick={() => setEditingGpo(null)}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-zinc-400 mb-1">
                    Название политики GPO
                  </label>
                  <input
                    value={editingGpo.name}
                    onChange={(e) =>
                      setEditingGpo({ ...editingGpo, name: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 mb-1">
                    Статус объекта GPO
                  </label>
                  <select
                    value={editingGpo.status}
                    onChange={(e) =>
                      setEditingGpo({ ...editingGpo, status: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                  >
                    <option value="AllSettingsEnabled">
                      AllSettingsEnabled (Включена)
                    </option>
                    <option value="UserDisabled">
                      User Configuration Disabled
                    </option>
                    <option value="ComputerDisabled">
                      Computer Configuration Disabled
                    </option>
                    <option value="AllDisabled">All Settings Disabled</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-zinc-400 mb-1">
                    Описание (Comment)
                  </label>
                  <input
                    value={editingGpo.description}
                    onChange={(e) =>
                      setEditingGpo({
                        ...editingGpo,
                        description: e.target.value,
                      })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100"
                  />
                </div>
              </div>

              {/* Linked OUs Editor */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3.5 space-y-2.5">
                <div className="font-semibold text-zinc-200">
                  1. Привязка политики к подразделениям (OU Links):
                </div>
                <div className="flex gap-2">
                  <select
                    value={linkOuToAdd}
                    onChange={(e) => setLinkOuToAdd(e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-zinc-200"
                  >
                    <option value="">
                      Выберите подразделение (OU) для привязки...
                    </option>
                    {allOus.map((o) => (
                      <option key={o.distinguishedName} value={o.distinguishedName}>
                        {o.name} ({o.distinguishedName})
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (
                        linkOuToAdd &&
                        !editingGpo.linkedOus.some(
                          (l) =>
                            l.ouDn.toLowerCase() === linkOuToAdd.toLowerCase()
                        )
                      ) {
                        setEditingGpo({
                          ...editingGpo,
                          linkedOus: [
                            ...editingGpo.linkedOus,
                            {
                              ouDn: linkOuToAdd,
                              enabled: true,
                              enforced: false,
                              order: editingGpo.linkedOus.length + 1,
                            },
                          ],
                        });
                        setLinkOuToAdd('');
                      }
                    }}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500"
                  >
                    + Привязать OU
                  </button>
                </div>

                <div className="space-y-1.5">
                  {editingGpo.linkedOus.map((link) => (
                    <div
                      key={link.ouDn}
                      className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5"
                    >
                      <span className="font-mono text-[11px] text-zinc-200">
                        {link.ouDn}
                      </span>
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-zinc-300">
                          <input
                            type="checkbox"
                            checked={link.enabled}
                            onChange={(e) =>
                              setEditingGpo({
                                ...editingGpo,
                                linkedOus: editingGpo.linkedOus.map((l) =>
                                  l.ouDn === link.ouDn
                                    ? { ...l, enabled: e.target.checked }
                                    : l
                                ),
                              })
                            }
                          />
                          Enabled
                        </label>
                        <label className="flex items-center gap-1 text-amber-300">
                          <input
                            type="checkbox"
                            checked={link.enforced}
                            onChange={(e) =>
                              setEditingGpo({
                                ...editingGpo,
                                linkedOus: editingGpo.linkedOus.map((l) =>
                                  l.ouDn === link.ouDn
                                    ? { ...l, enforced: e.target.checked }
                                    : l
                                ),
                              })
                            }
                          />
                          Enforced
                        </label>
                        <button
                          onClick={() =>
                            setEditingGpo({
                              ...editingGpo,
                              linkedOus: editingGpo.linkedOus.filter(
                                (l) => l.ouDn !== link.ouDn
                              ),
                            })
                          }
                          className="text-zinc-500 hover:text-rose-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Policy Settings / Rules Builder */}
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3.5 space-y-2.5">
                <div className="font-semibold text-zinc-200">
                  2. Конструктор параметров и правил политики GPO (
                  {editingGpo.keySettingsSummary.length}):
                </div>

                {/* Preset quick-toggle rules */}
                <div className="text-[11px] text-zinc-400">
                  Выберите из готовых шаблонов безопасности AD или добавьте свой
                  параметр реестра / политики:
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto p-1">
                  {presetPolicyRules.map((rule) => {
                    const active = editingGpo.keySettingsSummary.includes(rule);
                    return (
                      <label
                        key={rule}
                        className={`flex items-center gap-2 rounded border px-2.5 py-1.5 cursor-pointer font-mono text-[11px] ${
                          active
                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditingGpo({
                                ...editingGpo,
                                keySettingsSummary: [
                                  ...editingGpo.keySettingsSummary,
                                  rule,
                                ],
                              });
                            } else {
                              setEditingGpo({
                                ...editingGpo,
                                keySettingsSummary:
                                  editingGpo.keySettingsSummary.filter(
                                    (x) => x !== rule
                                  ),
                              });
                            }
                          }}
                        />
                        <span>{rule}</span>
                      </label>
                    );
                  })}
                </div>

                {/* Custom rule input */}
                <div className="flex gap-2 pt-1">
                  <input
                    value={newSettingText}
                    onChange={(e) => setNewSettingText(e.target.value)}
                    placeholder="Свой параметр GPO (например: HKLM\Software\Policies\... = 1)"
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-zinc-100"
                  />
                  <button
                    onClick={() => {
                      if (newSettingText.trim()) {
                        setEditingGpo({
                          ...editingGpo,
                          keySettingsSummary: [
                            ...editingGpo.keySettingsSummary,
                            newSettingText.trim(),
                          ],
                        });
                        setNewSettingText('');
                      }
                    }}
                    className="rounded-lg bg-zinc-800 px-3 py-1.5 text-zinc-200 hover:bg-zinc-700"
                  >
                    + Добавить правило
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
              <button
                onClick={() => setEditingGpo(null)}
                className="rounded-lg border border-zinc-800 px-4 py-2 text-xs text-zinc-400"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  onSaveGpo(editingGpo);
                  setEditingGpo(null);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-500"
              >
                <Save className="h-3.5 w-3.5" /> Сохранить политику GPO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
