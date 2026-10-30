import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Minus,
  Unlock,
  KeyRound,
  Power,
  UserX,
  Trash2,
  Save,
  Search,
  Code2,
  Copy,
  Users,
  Shield,
  GripHorizontal,
} from 'lucide-react';
import type { AdGroup, AdUser } from '../types';

interface Props {
  user: AdUser;
  allUsers: AdUser[];
  groups: AdGroup[];
  index: number;
  zIndex: number;
  minimized: boolean;
  onFocus: () => void;
  onClose: () => void;
  onToggleMinimize: () => void;
  onUpdateUser: (data: Record<string, unknown>) => void;
  onResetPassword: (
    userId: string,
    newPassword: string,
    mustChange: boolean,
    unlock: boolean
  ) => void;
  onUnlockUser: (userId: string) => void;
  onToggleUserEnabled: (userId: string, enabled: boolean) => void;
  onOffboardUser: (userId: string) => void;
  onDeleteUser: (userId: string) => void;
}

export const UserPropertyWindow: React.FC<Props> = ({
  user,
  allUsers,
  groups,
  index,
  zIndex,
  minimized,
  onFocus,
  onClose,
  onToggleMinimize,
  onUpdateUser,
  onResetPassword,
  onUnlockUser,
  onToggleUserEnabled,
  onOffboardUser,
  onDeleteUser,
}) => {
  const [editUser, setEditUser] = useState<AdUser>(() =>
    JSON.parse(JSON.stringify(user))
  );
  const [tab, setTab] = useState<'general' | 'groups' | 'ldap' | 'compare'>(
    'general'
  );

  // Groups tab search & "Active only" filter
  const [groupSearch, setGroupSearch] = useState('');
  const [onlyActiveGroups, setOnlyActiveGroups] = useState(false);

  // Compare tab target user
  const [compareUserId, setCompareUserId] = useState<string>(
    allUsers.find((u) => u.id !== user.id)?.id || ''
  );

  // LDAP custom attribute input
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrVal, setNewAttrVal] = useState('');

  // Reset password inline popover
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [resetPwdValue, setResetPwdValue] = useState('Satella#2026!Pass');
  const [resetMustChange, setResetMustChange] = useState(true);

  // Draggable window position
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.min(window.innerWidth - 520, 290 + index * 42),
    y: Math.min(window.innerHeight - 640, 72 + index * 34),
  }));
  const draggingRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  useEffect(() => {
    setEditUser(JSON.parse(JSON.stringify(user)));
  }, [user]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = e.clientX - draggingRef.current.startX;
      const dy = e.clientY - draggingRef.current.startY;
      setPos({
        x: Math.max(10, Math.min(window.innerWidth - 480, draggingRef.current.origX + dx)),
        y: Math.max(48, Math.min(window.innerHeight - 120, draggingRef.current.origY + dy)),
      });
    };
    const onMouseUp = () => {
      draggingRef.current = null;
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  if (minimized) return null;

  // Filtered groups in the Groups tab
  const filteredGroups = groups.filter((g) => {
    const isMember = editUser.memberOf.some(
      (m) => m.toLowerCase() === g.distinguishedName.toLowerCase()
    );
    if (onlyActiveGroups && !isMember) return false;
    if (groupSearch.trim()) {
      const q = groupSearch.toLowerCase();
      return (
        g.displayName.toLowerCase().includes(q) ||
        g.samAccountName.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const compareUser = allUsers.find((u) => u.id === compareUserId);

  return (
    <div
      onMouseDown={onFocus}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex,
      }}
      className="fixed w-[500px] h-[630px] rounded-xl border border-zinc-700/90 bg-zinc-950/98 shadow-2xl shadow-black/80 flex flex-col overflow-hidden backdrop-blur-md"
    >
      {/* Draggable Window Title Bar (like dsa.msc property sheet) */}
      <div
        onMouseDown={(e) => {
          onFocus();
          draggingRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: pos.x,
            origY: pos.y,
          };
        }}
        className="flex items-center justify-between border-b border-zinc-800 bg-gradient-to-r from-zinc-900 via-zinc-900 to-indigo-950/40 px-4 py-2.5 cursor-move select-none"
      >
        <div className="flex items-center gap-2.5 truncate">
          <GripHorizontal className="h-4 w-4 text-zinc-500 shrink-0" />
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-100 truncate">
                {editUser.displayName} — Свойства AD
              </span>
              {editUser.lockedOut && (
                <span className="rounded bg-rose-500/20 border border-rose-500/40 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
                  LOCKED
                </span>
              )}
              {!editUser.enabled && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  DISABLED
                </span>
              )}
            </div>
            <div className="font-mono text-[10px] text-zinc-400 truncate">
              {editUser.samAccountName} • {editUser.ouDn.split(',')[0]}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-1"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={onToggleMinimize}
            title="Свернуть карточку в нижнюю панель"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onClose}
            title="Закрыть окно"
            className="rounded p-1 text-zinc-400 hover:bg-rose-500/20 hover:text-rose-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Quick Action Strip */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800 bg-zinc-900/50 px-3.5 py-2">
        {editUser.lockedOut && (
          <button
            onClick={() => onUnlockUser(editUser.id)}
            className="flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-500"
          >
            <Unlock className="h-3 w-3" /> Разблокировать
          </button>
        )}
        <button
          onClick={() => setShowResetPwd((v) => !v)}
          className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
        >
          <KeyRound className="h-3 w-3 text-amber-400" /> Сброс пароля
        </button>
        <button
          onClick={() => onToggleUserEnabled(editUser.id, !editUser.enabled)}
          className="flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
        >
          <Power className="h-3 w-3 text-indigo-400" />
          {editUser.enabled ? 'Отключить' : 'Включить'}
        </button>
        <button
          onClick={() => onOffboardUser(editUser.id)}
          className="flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
        >
          <UserX className="h-3 w-3" /> Уволить
        </button>
        <button
          onClick={() => {
            onDeleteUser(editUser.id);
            onClose();
          }}
          className="flex items-center gap-1 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400 hover:text-rose-400 ml-auto"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Inline Reset Password Panel */}
      {showResetPwd && (
        <div className="border-b border-indigo-500/30 bg-indigo-950/30 px-4 py-2.5 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <input
              value={resetPwdValue}
              onChange={(e) => setResetPwdValue(e.target.value)}
              placeholder="Новый пароль"
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1 font-mono text-emerald-300"
            />
            <button
              onClick={() => {
                onResetPassword(
                  editUser.id,
                  resetPwdValue,
                  resetMustChange,
                  true
                );
                setShowResetPwd(false);
              }}
              className="rounded bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-500"
            >
              Применить
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-zinc-300">
            <input
              type="checkbox"
              checked={resetMustChange}
              onChange={(e) => setResetMustChange(e.target.checked)}
            />
            Требовать смену пароля при следующем входе
          </label>
        </div>
      )}

      {/* Window Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-950 px-4 pt-2 gap-4 text-xs">
        {[
          { id: 'general', label: 'Общие' },
          { id: 'groups', label: `Группы (${editUser.memberOf.length})` },
          { id: 'compare', label: 'Сравнить доступы' },
          { id: 'ldap', label: 'Атрибуты LDAP' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`pb-2 font-medium border-b-2 transition ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
        {tab === 'general' && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-zinc-400 block mb-1">Имя (givenName)</label>
                <input
                  value={editUser.givenName}
                  onChange={(e) =>
                    setEditUser({ ...editUser, givenName: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">Фамилия (sn)</label>
                <input
                  value={editUser.surname}
                  onChange={(e) =>
                    setEditUser({ ...editUser, surname: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
            </div>
            <div>
              <label className="text-zinc-400 block mb-1">
                Отображаемое имя (displayName)
              </label>
              <input
                value={editUser.displayName}
                onChange={(e) =>
                  setEditUser({ ...editUser, displayName: e.target.value })
                }
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
              />
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-zinc-400 block mb-1">
                  Должность (title)
                </label>
                <input
                  value={editUser.title}
                  onChange={(e) =>
                    setEditUser({ ...editUser, title: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Отдел (department)
                </label>
                <input
                  value={editUser.department}
                  onChange={(e) =>
                    setEditUser({ ...editUser, department: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-zinc-400 block mb-1">Почта (mail)</label>
                <input
                  value={editUser.email}
                  onChange={(e) =>
                    setEditUser({ ...editUser, email: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 font-mono"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Телефон (telephoneNumber)
                </label>
                <input
                  value={editUser.telephone}
                  onChange={(e) =>
                    setEditUser({ ...editUser, telephone: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-zinc-400 block mb-1">Офис (office)</label>
                <input
                  value={editUser.office}
                  onChange={(e) =>
                    setEditUser({ ...editUser, office: e.target.value })
                  }
                  className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-zinc-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editUser.passwordNeverExpires}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        passwordNeverExpires: e.target.checked,
                      })
                    }
                  />
                  Срок пароля не ограничен
                </label>
              </div>
            </div>
            <div>
              <label className="text-zinc-400 block mb-1">
                Описание (description)
              </label>
              <input
                value={editUser.description}
                onChange={(e) =>
                  setEditUser({ ...editUser, description: e.target.value })
                }
                className="w-full rounded border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
              />
            </div>
            <div>
              <label className="text-zinc-400 block mb-1">
                Distinguished Name (DN)
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  readOnly
                  value={editUser.distinguishedName}
                  className="flex-1 rounded border border-zinc-800/60 bg-zinc-900/40 px-2.5 py-1.5 text-zinc-400 font-mono text-[11px]"
                />
                <button
                  onClick={() =>
                    navigator.clipboard.writeText(editUser.distinguishedName)
                  }
                  title="Копировать DN"
                  className="rounded border border-zinc-800 bg-zinc-900 p-1.5 text-zinc-400 hover:text-zinc-200"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </>
        )}

        {tab === 'groups' && (
          <div className="space-y-3">
            {/* Search & "Only Active Groups" Checkbox + Copy from Colleague */}
            <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/50 p-2.5">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  value={groupSearch}
                  onChange={(e) => setGroupSearch(e.target.value)}
                  placeholder="Поиск группы по названию или описанию (например: VPN, 1C, GitLab)..."
                  className="w-full rounded-md border border-zinc-800 bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-indigo-300 font-medium cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={onlyActiveGroups}
                    onChange={(e) => setOnlyActiveGroups(e.target.checked)}
                    className="rounded border-zinc-700"
                  />
                  Показывать только активные группы ({editUser.memberOf.length})
                </label>

                <select
                  defaultValue=""
                  onChange={(e) => {
                    const colleague = allUsers.find(
                      (u) => u.id === e.target.value
                    );
                    if (colleague) {
                      const merged = Array.from(
                        new Set([...editUser.memberOf, ...colleague.memberOf])
                      );
                      setEditUser({ ...editUser, memberOf: merged });
                      e.target.value = '';
                    }
                  }}
                  className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
                >
                  <option value="">+ Скопировать группы у коллеги...</option>
                  {allUsers
                    .filter((u) => u.id !== editUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.displayName} ({u.memberOf.length} гр.)
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Filtered Group List */}
            <div className="space-y-1.5">
              {filteredGroups.length === 0 ? (
                <div className="py-6 text-center text-zinc-500">
                  Группы по заданному фильтру не найдены
                </div>
              ) : (
                filteredGroups.map((g) => {
                  const isMember = editUser.memberOf.some(
                    (m) => m.toLowerCase() === g.distinguishedName.toLowerCase()
                  );
                  return (
                    <label
                      key={g.id}
                      className={`flex items-center justify-between rounded-lg border p-2.5 cursor-pointer transition ${
                        isMember
                          ? 'border-indigo-500/40 bg-indigo-500/10'
                          : 'border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={isMember}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditUser({
                                ...editUser,
                                memberOf: [
                                  ...editUser.memberOf,
                                  g.distinguishedName,
                                ],
                              });
                            } else {
                              setEditUser({
                                ...editUser,
                                memberOf: editUser.memberOf.filter(
                                  (x) =>
                                    x.toLowerCase() !==
                                    g.distinguishedName.toLowerCase()
                                ),
                              });
                            }
                          }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5 font-medium text-zinc-100">
                            <Shield className="h-3 w-3 text-amber-400" />
                            {g.displayName}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            {g.description}
                          </div>
                        </div>
                      </div>
                      {isMember && (
                        <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                          Активна
                        </span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}

        {tab === 'compare' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
              <div className="flex items-center gap-2 text-zinc-300 font-medium">
                <Users className="h-3.5 w-3.5 text-indigo-400" />
                Сравнить членство в группах с другим пользователем:
              </div>
              <select
                value={compareUserId}
                onChange={(e) => setCompareUserId(e.target.value)}
                className="w-full rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
              >
                {allUsers
                  .filter((u) => u.id !== editUser.id)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} ({u.samAccountName}) — {u.title}
                    </option>
                  ))}
              </select>
            </div>

            {compareUser && (
              <div className="space-y-2">
                {groups.map((g) => {
                  const hasA = editUser.memberOf.some(
                    (m) => m.toLowerCase() === g.distinguishedName.toLowerCase()
                  );
                  const hasB = compareUser.memberOf.some(
                    (m) => m.toLowerCase() === g.distinguishedName.toLowerCase()
                  );
                  if (!hasA && !hasB) return null;

                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2"
                    >
                      <span className="font-medium text-zinc-200">
                        {g.displayName}
                      </span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span
                          className={`rounded px-2 py-0.5 ${
                            hasA
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          {editUser.samAccountName}: {hasA ? 'Да' : 'Нет'}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 ${
                            hasB
                              ? 'bg-indigo-500/20 text-indigo-300'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          {compareUser.samAccountName}: {hasB ? 'Да' : 'Нет'}
                        </span>
                        {!hasA && hasB && (
                          <button
                            onClick={() =>
                              setEditUser({
                                ...editUser,
                                memberOf: [
                                  ...editUser.memberOf,
                                  g.distinguishedName,
                                ],
                              })
                            }
                            className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] text-white hover:bg-indigo-500"
                          >
                            + Добавить
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'ldap' && (
          <div className="space-y-3">
            <div className="flex items-center gap-1.5 text-[11px] text-indigo-300">
              <Code2 className="h-3.5 w-3.5" /> Редактор LDAP-атрибутов
              (Attribute Editor)
            </div>
            <div className="space-y-1.5">
              {Object.entries(editUser.customAttributes || {}).map(([k, v]) => (
                <div
                  key={k}
                  className="grid grid-cols-5 gap-2 items-center rounded border border-zinc-800/80 bg-zinc-900/40 px-2.5 py-1.5"
                >
                  <span className="col-span-2 font-mono text-[11px] text-zinc-400 truncate">
                    {k}
                  </span>
                  <input
                    value={v}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        customAttributes: {
                          ...editUser.customAttributes,
                          [k]: e.target.value,
                        },
                      })
                    }
                    className="col-span-3 rounded bg-zinc-950 border border-zinc-800 px-2 py-1 font-mono text-[11px] text-emerald-300"
                  />
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-800 pt-2.5">
              <div className="text-[11px] text-zinc-400 mb-1.5">
                Добавить атрибут схемы AD:
              </div>
              <div className="flex gap-1.5">
                <input
                  placeholder="extensionAttribute1"
                  value={newAttrKey}
                  onChange={(e) => setNewAttrKey(e.target.value)}
                  className="w-1/2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px]"
                />
                <input
                  placeholder="Значение"
                  value={newAttrVal}
                  onChange={(e) => setNewAttrVal(e.target.value)}
                  className="w-1/2 rounded border border-zinc-800 bg-zinc-900 px-2 py-1 font-mono text-[11px]"
                />
                <button
                  onClick={() => {
                    if (newAttrKey.trim()) {
                      setEditUser({
                        ...editUser,
                        customAttributes: {
                          ...editUser.customAttributes,
                          [newAttrKey.trim()]: newAttrVal,
                        },
                      });
                      setNewAttrKey('');
                      setNewAttrVal('');
                    }
                  }}
                  className="rounded bg-zinc-800 px-2.5 text-zinc-200 hover:bg-zinc-700"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Save Bar */}
      <div className="border-t border-zinc-800 p-3 bg-zinc-900/60 flex items-center justify-between">
        <span className="text-[11px] text-zinc-500">
          Окно можно перетаскивать за заголовок
        </span>
        <button
          onClick={() =>
            onUpdateUser(editUser as unknown as Record<string, unknown>)
          }
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
        >
          <Save className="h-3.5 w-3.5" /> Применить и сохранить
        </button>
      </div>
    </div>
  );
};

