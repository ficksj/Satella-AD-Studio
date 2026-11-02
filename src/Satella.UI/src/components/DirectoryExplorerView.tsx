import React, { useState } from 'react';
import {
  FolderTree,
  Folder,
  FolderOpen,
  User,
  Shield,
  Plus,
  Search,
  Unlock,
  KeyRound,
  CheckSquare,
  Square,
  ChevronRight,
  ChevronDown,
  GripVertical,
  ExternalLink,
  Download,
} from 'lucide-react';
import type { AdGroup, AdUser, OuNode } from '../types';

interface Props {
  ouTree: OuNode[];
  users: AdUser[];
  groups: AdGroup[];
  openUserIds: string[];
  onOpenUserWindow: (user: AdUser) => void;
  onCreateOu: (data: {
    name: string;
    parentDn: string;
    description: string;
    protectedFromAccidentalDeletion: boolean;
  }) => void;
  onMoveObject: (objectId: string, objectClass: string, targetOuDn: string) => void;
  onCreateUser: (data: Record<string, unknown>) => void;
  onResetPassword: (
    userId: string,
    newPassword: string,
    mustChange: boolean,
    unlock: boolean
  ) => void;
  onUnlockUser: (userId: string) => void;
  onBulkAction: (
    userIds: string[],
    action: string,
    targetOuDn?: string,
    groupDn?: string
  ) => void;
  onCreateGroup: (data: Record<string, unknown>) => void;
}

export const DirectoryExplorerView: React.FC<Props> = ({
  ouTree,
  users,
  groups,
  openUserIds,
  onOpenUserWindow,
  onCreateOu,
  onMoveObject,
  onCreateUser,
  onResetPassword,
  onUnlockUser,
  onBulkAction,
  onCreateGroup,
}) => {
  const [selectedOuDn, setSelectedOuDn] = useState<string>('');
  const [expandedOus, setExpandedOus] = useState<Record<string, boolean>>({
    'DC=corp,DC=satella,DC=local': true,
    'OU=HQ Moscow,DC=corp,DC=satella,DC=local': true,
    'OU=Workstations,DC=corp,DC=satella,DC=local': true,
  });
  const [dragOverOu, setDragOverOu] = useState<string | null>(null);

  const [subTab, setSubTab] = useState<'users' | 'groups'>('users');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState<string>('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [resetPwdTarget, setResetPwdTarget] = useState<AdUser | null>(null);
  const [resetPwdValue, setResetPwdValue] = useState('Satella#2026!Pass');
  const [resetMustChange, setResetMustChange] = useState(true);

  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    givenName: '',
    surname: '',
    samAccountName: '',
    title: 'Software Engineer',
    department: 'Engineering',
    email: '',
    telephone: '+7 (495) 700-',
    password: 'Satella#2026!User',
  });

  const [showCreateOuModal, setShowCreateOuModal] = useState(false);
  const [newOuForm, setNewOuForm] = useState({
    name: '',
    description: '',
  });

  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [newGroupForm, setNewGroupForm] = useState({
    samAccountName: '',
    description: '',
    groupScope: 'Global',
    groupCategory: 'Security',
  });

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (
      selectedOuDn &&
      selectedOuDn !== 'DC=corp,DC=satella,DC=local' &&
      !u.ouDn.toLowerCase().endsWith(selectedOuDn.toLowerCase())
    ) {
      return false;
    }
    if (statusFilter === 'active' && (!u.enabled || u.lockedOut)) return false;
    if (statusFilter === 'locked' && !u.lockedOut) return false;
    if (statusFilter === 'disabled' && u.enabled) return false;
    if (statusFilter === 'expiring') {
      if (!u.enabled || u.passwordNeverExpires || !u.passwordExpiresAt)
        return false;
      const days =
        (new Date(u.passwordExpiresAt).getTime() - Date.now()) / 86400000;
      if (days > 7) return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        u.displayName.toLowerCase().includes(q) ||
        u.samAccountName.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.telephone.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredGroups = groups.filter((g) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      g.displayName.toLowerCase().includes(q) ||
      g.description.toLowerCase().includes(q)
    );
  });

  const toggleSelectUser = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredUsers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredUsers.map((u) => u.id));
    }
  };

  const handleExportCsv = () => {
    const header =
      'DisplayName,SamAccountName,Email,Title,Department,OU,Enabled,LockedOut\n';
    const rows = filteredUsers
      .map(
        (u) =>
          `"${u.displayName}","${u.samAccountName}","${u.email}","${u.title}","${u.department}","${u.ouDn}",${u.enabled},${u.lockedOut}`
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + header + rows], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satella-ad-users-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderOuNode = (node: OuNode, depth = 0) => {
    const isExpanded = !!expandedOus[node.distinguishedName];
    const isSelected = selectedOuDn === node.distinguishedName;
    const isDragOver = dragOverOu === node.distinguishedName;
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.distinguishedName}>
        <div
          onClick={() => setSelectedOuDn(node.distinguishedName)}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverOu(node.distinguishedName);
          }}
          onDragLeave={() => setDragOverOu(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverOu(null);
            const raw = e.dataTransfer.getData('application/satella-object');
            if (raw) {
              const parsed = JSON.parse(raw);
              onMoveObject(parsed.id, parsed.objectClass, node.distinguishedName);
            }
          }}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
          className={`flex items-center justify-between rounded-lg py-1.5 pr-2 text-xs cursor-pointer transition ${
            isDragOver
              ? 'bg-indigo-600/30 border border-indigo-400 text-white'
              : isSelected
              ? 'bg-indigo-500/15 text-indigo-300 font-medium'
              : 'text-zinc-300 hover:bg-zinc-900'
          }`}
        >
          <div className="flex items-center gap-1.5 truncate">
            {hasChildren ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedOus((p) => ({
                    ...p,
                    [node.distinguishedName]: !isExpanded,
                  }));
                }}
                className="text-zinc-500 hover:text-zinc-300"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5" />
            )}
            {isSelected || isExpanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-amber-500/80 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </div>
          {node.userCount + node.computerCount > 0 && (
            <span className="rounded bg-zinc-800/90 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
              {node.userCount + node.computerCount}
            </span>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="mt-0.5 space-y-0.5">
            {node.children.map((child) => renderOuNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left Pane: OU Tree with Drag & Drop */}
      <div className="w-72 shrink-0 border-r border-zinc-800 bg-zinc-950/60 flex flex-col">
        <div className="flex items-center justify-between border-b border-zinc-800 px-3.5 py-3">
          <div className="flex items-center gap-2">
            <FolderTree className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-200">
              Дерево OU
            </span>
          </div>
          <button
            onClick={() => setShowCreateOuModal(true)}
            className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-700 hover:text-white"
          >
            <Plus className="h-3 w-3" /> OU
          </button>
        </div>

        <div className="p-2 flex-1 overflow-y-auto space-y-0.5">
          {ouTree.map((root) => renderOuNode(root, 0))}
        </div>

        <div className="border-t border-zinc-800 bg-zinc-900/40 p-2.5 text-[11px] text-zinc-500 leading-tight space-y-1">
          <div>
            Перетащите пользователя на папку OU для перемещения (
            <code className="text-emerald-400">Move-ADObject</code>).
          </div>
          <div className="text-zinc-400">
            Клик по строке открывает отдельное окно свойств AD (поддерживается несколько окон одновременно).
          </div>
        </div>
      </div>

      {/* Center Pane: Users / Groups Table */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
              <button
                onClick={() => setSubTab('users')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                  subTab === 'users'
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <User className="h-3.5 w-3.5" /> Пользователи (
                {filteredUsers.length})
              </button>
              <button
                onClick={() => setSubTab('groups')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition ${
                  subTab === 'groups'
                    ? 'bg-indigo-600 text-white'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Shield className="h-3.5 w-3.5" /> Группы ({filteredGroups.length}
                )
              </button>
            </div>

            {subTab === 'users' && (
              <div className="flex items-center gap-1 ml-2">
                {[
                  { id: 'all', label: 'Все' },
                  { id: 'active', label: 'Активные' },
                  { id: 'locked', label: 'Заблокированные' },
                  { id: 'expiring', label: 'Истекает пароль' },
                  { id: 'disabled', label: 'Отключённые' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setStatusFilter(f.id)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                      statusFilter === f.id
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700'
                        : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-60">
              <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Фильтр по ФИО, логину, отделу..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {subTab === 'users' && (
              <button
                onClick={handleExportCsv}
                title="Экспорт списка пользователей в CSV"
                className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800"
              >
                <Download className="h-3.5 w-3.5" /> CSV
              </button>
            )}

            {subTab === 'users' ? (
              <button
                onClick={() => setShowCreateUserModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Новый пользователь
              </button>
            ) : (
              <button
                onClick={() => setShowCreateGroupModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Новая группа
              </button>
            )}
          </div>
        </div>

        {/* Bulk Action Bar */}
        {subTab === 'users' && selectedIds.length > 0 && (
          <div className="flex items-center justify-between bg-indigo-950/50 border-b border-indigo-500/30 px-5 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-indigo-300">
                Выбрано объектов: {selectedIds.length}
              </span>
              <button
                onClick={() => {
                  selectedIds.slice(0, 5).forEach((id) => {
                    const u = users.find((x) => x.id === id);
                    if (u) onOpenUserWindow(u);
                  });
                }}
                className="rounded bg-indigo-600/30 border border-indigo-500/40 px-2 py-0.5 text-[11px] text-indigo-200 hover:bg-indigo-600/50"
              >
                Открыть карточки выбранных ({Math.min(5, selectedIds.length)})
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="text-zinc-400 hover:text-zinc-200 underline text-[11px]"
              >
                Снять выделение
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onBulkAction(selectedIds, 'unlock');
                  setSelectedIds([]);
                }}
                className="rounded bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/30"
              >
                Разблокировать все
              </button>
              <button
                onClick={() => {
                  onBulkAction(selectedIds, 'enable');
                  setSelectedIds([]);
                }}
                className="rounded bg-zinc-800 border border-zinc-700 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
              >
                Включить
              </button>
              <button
                onClick={() => {
                  onBulkAction(selectedIds, 'disable');
                  setSelectedIds([]);
                }}
                className="rounded bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 text-[11px] text-rose-300 hover:bg-rose-500/30"
              >
                Отключить
              </button>
              <select
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) {
                    onBulkAction(
                      selectedIds,
                      'addgroup',
                      undefined,
                      e.target.value
                    );
                    setSelectedIds([]);
                    e.target.value = '';
                  }
                }}
                className="rounded bg-zinc-900 border border-zinc-700 px-2 py-1 text-[11px] text-zinc-200"
              >
                <option value="">+ Добавить в группу...</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.distinguishedName}>
                    {g.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto">
          {subTab === 'users' ? (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-2.5 pl-4 pr-2 w-8">
                    <button onClick={toggleSelectAll} className="text-zinc-400">
                      {selectedIds.length > 0 &&
                      selectedIds.length === filteredUsers.length ? (
                        <CheckSquare className="h-3.5 w-3.5 text-indigo-400" />
                      ) : (
                        <Square className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="py-2.5 px-3">Сотрудник / Логин</th>
                  <th className="py-2.5 px-3">Должность и Отдел</th>
                  <th className="py-2.5 px-3">Подразделение (OU)</th>
                  <th className="py-2.5 px-3">Группы</th>
                  <th className="py-2.5 px-3">Статус</th>
                  <th className="py-2.5 pr-4 text-right">Окно / Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs">
                {filteredUsers.map((u) => {
                  const isChecked = selectedIds.includes(u.id);
                  const isWindowOpen = openUserIds.includes(u.id);
                  const shortOu =
                    u.ouDn.split(',')[0]?.replace('OU=', '') || 'Root';

                  return (
                    <tr
                      key={u.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(
                          'application/satella-object',
                          JSON.stringify({ id: u.id, objectClass: 'user' })
                        );
                      }}
                      onClick={() => onOpenUserWindow(u)}
                      className={`cursor-pointer transition ${
                        isWindowOpen
                          ? 'bg-indigo-500/10'
                          : isChecked
                          ? 'bg-zinc-900/80'
                          : 'hover:bg-zinc-900/50'
                      }`}
                    >
                      <td
                        className="py-2.5 pl-4 pr-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectUser(u.id);
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <GripVertical className="h-3 w-3 text-zinc-600 cursor-grab" />
                          {isChecked ? (
                            <CheckSquare className="h-3.5 w-3.5 text-indigo-400" />
                          ) : (
                            <Square className="h-3.5 w-3.5 text-zinc-600" />
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2 font-medium text-zinc-100">
                          <span>{u.displayName}</span>
                          {isWindowOpen && (
                            <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] text-indigo-300">
                              Окно открыто
                            </span>
                          )}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-400">
                          {u.samAccountName} • {u.email}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="text-zinc-200">{u.title}</div>
                        <div className="text-[11px] text-zinc-500">
                          {u.department}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded bg-zinc-900 border border-zinc-800 px-2 py-0.5 font-mono text-[11px] text-zinc-300">
                          {shortOu}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[11px] text-indigo-300">
                          {u.memberOf.length} групп
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        {!u.enabled ? (
                          <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                            Отключён
                          </span>
                        ) : u.lockedOut ? (
                          <span className="rounded bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[11px] font-medium text-rose-400">
                            Заблокирован
                          </span>
                        ) : (
                          <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] text-emerald-400">
                            Активен
                          </span>
                        )}
                      </td>
                      <td
                        className="py-2.5 pr-4 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1.5">
                          {u.lockedOut && (
                            <button
                              onClick={() => onUnlockUser(u.id)}
                              title="Разблокировать"
                              className="rounded bg-emerald-500/15 p-1 text-emerald-400 hover:bg-emerald-500/25"
                            >
                              <Unlock className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => setResetPwdTarget(u)}
                            title="Сбросить пароль"
                            className="rounded bg-zinc-800 p-1 text-zinc-300 hover:bg-zinc-700"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => onOpenUserWindow(u)}
                            title="Открыть отдельное окно свойств пользователя"
                            className="flex items-center gap-1 rounded bg-indigo-600/20 border border-indigo-500/30 px-2 py-1 text-[11px] text-indigo-300 hover:bg-indigo-600/30"
                          >
                            <ExternalLink className="h-3 w-3" /> Карточка
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-zinc-950 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="py-2.5 pl-5 pr-3">Название группы (CN)</th>
                  <th className="py-2.5 px-3">Тип / Область</th>
                  <th className="py-2.5 px-3">Описание</th>
                  <th className="py-2.5 pr-5 text-right">Участники</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 text-xs">
                {filteredGroups.map((g) => (
                  <tr key={g.id} className="hover:bg-zinc-900/50">
                    <td className="py-3 pl-5 pr-3">
                      <div className="font-semibold text-zinc-100 flex items-center gap-2">
                        <Shield className="h-3.5 w-3.5 text-amber-400" />
                        {g.displayName}
                      </div>
                      <div className="font-mono text-[10px] text-zinc-500 mt-0.5">
                        {g.distinguishedName}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                        {g.groupCategory} • {g.groupScope}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-400">{g.description}</td>
                    <td className="py-3 pr-5 text-right font-mono text-indigo-300">
                      {g.members.length} чел.
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modal: Reset Password */}
      {resetPwdTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              Сброс пароля: {resetPwdTarget.displayName} (
              {resetPwdTarget.samAccountName})
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Новый пароль</label>
                <input
                  value={resetPwdValue}
                  onChange={(e) => setResetPwdValue(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 font-mono text-emerald-300"
                />
              </div>
              <label className="flex items-center gap-2 text-zinc-300">
                <input
                  type="checkbox"
                  checked={resetMustChange}
                  onChange={(e) => setResetMustChange(e.target.checked)}
                />
                Потребовать смену пароля при следующем входе в систему
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setResetPwdTarget(null)}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  onResetPassword(
                    resetPwdTarget.id,
                    resetPwdValue,
                    resetMustChange,
                    true
                  );
                  setResetPwdTarget(null);
                }}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Сбросить и разблокировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create User */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              Создание нового пользователя Active Directory
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Имя</label>
                <input
                  value={newUserForm.givenName}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, givenName: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Фамилия</label>
                <input
                  value={newUserForm.surname}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, surname: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">
                  Логин (sAMAccountName)
                </label>
                <input
                  value={newUserForm.samAccountName}
                  onChange={(e) =>
                    setNewUserForm({
                      ...newUserForm,
                      samAccountName: e.target.value,
                    })
                  }
                  placeholder="i.ivanov"
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Пароль</label>
                <input
                  value={newUserForm.password}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, password: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Должность</label>
                <input
                  value={newUserForm.title}
                  onChange={(e) =>
                    setNewUserForm({ ...newUserForm, title: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Отдел</label>
                <input
                  value={newUserForm.department}
                  onChange={(e) =>
                    setNewUserForm({
                      ...newUserForm,
                      department: e.target.value,
                    })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowCreateUserModal(false)}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  onCreateUser({
                    ...newUserForm,
                    displayName: `${newUserForm.surname} ${newUserForm.givenName}`.trim(),
                    company: 'Satella Enterprise',
                    office: 'HQ Moscow',
                    ouDn:
                      selectedOuDn ||
                      'OU=Engineering,OU=HQ Moscow,DC=corp,DC=satella,DC=local',
                    enabled: true,
                    mustChangePasswordNextLogon: true,
                    memberOf: [],
                  });
                  setShowCreateUserModal(false);
                }}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
              >
                Создать в AD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create OU */}
      {showCreateOuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              Создать подразделение (Organizational Unit)
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Название OU</label>
                <input
                  value={newOuForm.name}
                  onChange={(e) =>
                    setNewOuForm({ ...newOuForm, name: e.target.value })
                  }
                  placeholder="Cloud Platform"
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Описание</label>
                <input
                  value={newOuForm.description}
                  onChange={(e) =>
                    setNewOuForm({ ...newOuForm, description: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5"
                />
              </div>
              <div className="text-[11px] text-zinc-500 font-mono">
                Родительский путь:{' '}
                {selectedOuDn || 'DC=corp,DC=satella,DC=local'}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateOuModal(false)}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  onCreateOu({
                    name: newOuForm.name,
                    parentDn: selectedOuDn || 'DC=corp,DC=satella,DC=local',
                    description: newOuForm.description,
                    protectedFromAccidentalDeletion: true,
                  });
                  setShowCreateOuModal(false);
                }}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white"
              >
                Создать OU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Group */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">
              Создать группу Active Directory
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 mb-1">Имя группы</label>
                <input
                  value={newGroupForm.samAccountName}
                  onChange={(e) =>
                    setNewGroupForm({
                      ...newGroupForm,
                      samAccountName: e.target.value,
                    })
                  }
                  placeholder="VPN-Contractors"
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5"
                />
              </div>
              <div>
                <label className="block text-zinc-400 mb-1">Описание</label>
                <input
                  value={newGroupForm.description}
                  onChange={(e) =>
                    setNewGroupForm({
                      ...newGroupForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateGroupModal(false)}
                className="rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-400"
              >
                Отмена
              </button>
              <button
                onClick={() => {
                  onCreateGroup({
                    ...newGroupForm,
                    displayName: newGroupForm.samAccountName,
                    ouDn: 'OU=Security Groups,DC=corp,DC=satella,DC=local',
                    email: '',
                  });
                  setShowCreateGroupModal(false);
                }}
                className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white"
              >
                Создать группу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
