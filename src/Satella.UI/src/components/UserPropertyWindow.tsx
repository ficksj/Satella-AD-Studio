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
  Clock,
  Monitor,
  Building2,
  FolderKanban,
  Phone,
  UserCheck,
  ExternalLink,
  Check,
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
  onOpenUserWindow?: (user: AdUser) => void;
}

const DAYS_OF_WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const DRIVE_LETTERS = [
  'H:',
  'I:',
  'J:',
  'K:',
  'L:',
  'M:',
  'N:',
  'O:',
  'P:',
  'Q:',
  'R:',
  'S:',
  'T:',
  'U:',
  'V:',
  'W:',
  'X:',
  'Y:',
  'Z:',
];

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
  onOpenUserWindow,
}) => {
  const [editUser, setEditUser] = useState<AdUser>(() =>
    JSON.parse(JSON.stringify(user))
  );
  const [tab, setTab] = useState<
    | 'general'
    | 'address'
    | 'account'
    | 'profile'
    | 'organization'
    | 'groups'
    | 'rdp'
    | 'ldap'
  >('general');

  // Groups tab search & "Active only" filter & compare mode
  const [groupSearch, setGroupSearch] = useState('');
  const [onlyActiveGroups, setOnlyActiveGroups] = useState(false);
  const [showCompareMode, setShowCompareMode] = useState(false);
  const [compareUserId, setCompareUserId] = useState<string>(
    allUsers.find((u) => u.id !== user.id)?.id || ''
  );

  // LDAP custom attribute input & filter
  const [attrSearch, setAttrSearch] = useState('');
  const [onlyFilledAttrs, setOnlyFilledAttrs] = useState(false);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrVal, setNewAttrVal] = useState('');

  // Reset password inline popover
  const [showResetPwd, setShowResetPwd] = useState(false);
  const [resetPwdValue, setResetPwdValue] = useState('Satella#2026!Pass');
  const [resetMustChange, setResetMustChange] = useState(true);

  // Logon Hours & Logon Workstations modals inside Account tab
  const [showLogonHoursModal, setShowLogonHoursModal] = useState(false);
  const [showWorkstationsModal, setShowWorkstationsModal] = useState(false);

  // 7x24 boolean matrix for Logon Hours
  const [logonMatrix, setLogonMatrix] = useState<boolean[][]>(() =>
    Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => true))
  );

  // Draggable window position
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: Math.min(window.innerWidth - 650, 260 + index * 38),
    y: Math.min(window.innerHeight - 700, 56 + index * 28),
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
        x: Math.max(
          10,
          Math.min(window.innerWidth - 520, draggingRef.current.origX + dx)
        ),
        y: Math.max(
          48,
          Math.min(window.innerHeight - 100, draggingRef.current.origY + dy)
        ),
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

  // Helper to read/write custom LDAP attributes cleanly
  const getAttr = (key: string, fallback = '') =>
    editUser.customAttributes?.[key] ?? fallback;

  const setAttr = (key: string, value: string) => {
    setEditUser((prev) => ({
      ...prev,
      customAttributes: {
        ...(prev.customAttributes || {}),
        [key]: value,
      },
    }));
  };

  const getBoolAttr = (key: string, fallback = false) => {
    const val = editUser.customAttributes?.[key];
    if (val === undefined) return fallback;
    return val.toLowerCase() === 'true' || val === '1';
  };

  const setBoolAttr = (key: string, value: boolean) => {
    setAttr(key, value ? 'TRUE' : 'FALSE');
  };

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

  // Manager and Direct Reports
  const currentManager = allUsers.find(
    (u) =>
      (editUser.managerDn &&
        u.distinguishedName.toLowerCase() ===
          editUser.managerDn.toLowerCase()) ||
      (getAttr('manager') &&
        u.distinguishedName.toLowerCase() === getAttr('manager').toLowerCase())
  );

  const directReports = allUsers.filter(
    (u) =>
      u.id !== editUser.id &&
      ((u.managerDn &&
        u.managerDn.toLowerCase() ===
          editUser.distinguishedName.toLowerCase()) ||
        (u.customAttributes?.['manager'] &&
          u.customAttributes['manager'].toLowerCase() ===
            editUser.distinguishedName.toLowerCase()))
  );

  // Split UPN into login + domain suffix
  const upnParts = (
    editUser.userPrincipalName || `${editUser.samAccountName}@corp.satella.local`
  ).split('@');
  const upnPrefix = upnParts[0] || editUser.samAccountName;
  const upnSuffix = upnParts[1] || 'corp.satella.local';

  // Canonical Name calculation for Object tab
  const canonicalName = (() => {
    const parts = editUser.distinguishedName.split(',');
    const dcs = parts
      .filter((p) => p.startsWith('DC='))
      .map((p) => p.replace('DC=', ''))
      .join('.');
    const ous = parts
      .filter((p) => p.startsWith('OU='))
      .map((p) => p.replace('OU=', ''))
      .reverse();
    return [dcs, ...ous, editUser.displayName].filter(Boolean).join('/');
  })();

  const handleSave = (closeAfter: boolean) => {
    onUpdateUser(editUser as unknown as Record<string, unknown>);
    if (closeAfter) onClose();
  };

  return (
    <div
      onMouseDown={onFocus}
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex,
      }}
      className="fixed w-[640px] h-[690px] rounded-lg border border-zinc-700 bg-zinc-950 shadow-2xl shadow-black/80 flex flex-col overflow-hidden"
    >
      {/* Draggable Window Title Bar (classic dsa.msc Properties header) */}
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
        className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900 px-4 py-2.5 cursor-move select-none"
      >
        <div className="flex items-center gap-2.5 truncate">
          <GripHorizontal className="h-4 w-4 text-zinc-500 shrink-0" />
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-100 truncate">
                Свойства: {editUser.displayName} ({editUser.samAccountName})
              </span>
              {editUser.lockedOut && (
                <span className="rounded bg-rose-500/20 border border-rose-500/40 px-1.5 py-0.5 text-[10px] font-bold text-rose-400">
                  ЗАБЛОКИРОВАН
                </span>
              )}
              {!editUser.enabled && (
                <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                  ОТКЛЮЧЁН
                </span>
              )}
            </div>
            <div className="font-mono text-[10px] text-zinc-400 truncate">
              {canonicalName}
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

      {/* Quick Action Strip (AD Tasks Toolbar) */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-zinc-800 bg-zinc-900/40 px-4 py-2">
        {editUser.lockedOut && (
          <button
            onClick={() => {
              setEditUser({ ...editUser, lockedOut: false });
              onUnlockUser(editUser.id);
            }}
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-emerald-500"
          >
            <Unlock className="h-3 w-3" /> Разблокировать
          </button>
        )}
        <button
          onClick={() => setShowResetPwd((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
        >
          <KeyRound className="h-3 w-3 text-amber-400" /> Сбросить пароль...
        </button>
        <button
          onClick={() => {
            const nextState = !editUser.enabled;
            setEditUser({ ...editUser, enabled: nextState });
            onToggleUserEnabled(editUser.id, nextState);
          }}
          className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
        >
          <Power className="h-3 w-3 text-indigo-400" />
          {editUser.enabled ? 'Отключить учётную запись' : 'Включить учётную запись'}
        </button>
        <button
          onClick={() => onOffboardUser(editUser.id)}
          className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-300 hover:bg-rose-500/20"
        >
          <UserX className="h-3 w-3" /> Оффбординг (Уволить)
        </button>
        <button
          onClick={() => {
            onDeleteUser(editUser.id);
            onClose();
          }}
          title="Удалить объект в Корзину AD"
          className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-400 hover:text-rose-400 ml-auto"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {/* Inline Reset Password Panel */}
      {showResetPwd && (
        <div className="border-b border-indigo-500/30 bg-zinc-900/90 px-4 py-2.5 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <input
              value={resetPwdValue}
              onChange={(e) => setResetPwdValue(e.target.value)}
              placeholder="Новый пароль"
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 font-mono text-emerald-300"
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
              className="rounded-lg bg-indigo-600 px-3 py-1.5 font-medium text-white hover:bg-indigo-500"
            >
              Сменить пароль
            </button>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-[11px] text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={resetMustChange}
                onChange={(e) => setResetMustChange(e.target.checked)}
              />
              Требовать смену пароля при следующем входе
            </label>
            <span className="text-[11px] text-emerald-400">
              ✓ Автоматическая разблокировка учётной записи
            </span>
          </div>
        </div>
      )}

      {/* Multi-row / Scrollable Classic AD Property Sheet Tabs */}
      <div className="flex flex-wrap border-b border-zinc-800 bg-zinc-900/60 px-3 pt-1.5 gap-1 text-[11px]">
        {[
          { id: 'general', label: 'Общие' },
          { id: 'address', label: 'Адрес и Телефоны' },
          { id: 'account', label: 'Учётная запись' },
          { id: 'profile', label: 'Профиль' },
          { id: 'organization', label: 'Организация' },
          { id: 'groups', label: `Членство в группах (${editUser.memberOf.length})` },
          { id: 'rdp', label: 'Сеансы RDP' },
          { id: 'ldap', label: 'Объект и Атрибуты' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`px-2.5 py-1.5 rounded-t-lg font-medium border-b-2 transition ${
              tab === t.id
                ? 'border-indigo-500 bg-zinc-950 text-indigo-300'
                : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
        {/* 1. GENERAL TAB (Общие) */}
        {tab === 'general' && (
          <div className="space-y-3">
            <div className="grid grid-cols-12 gap-2.5">
              <div className="col-span-5">
                <label className="text-zinc-400 block mb-1">Имя (givenName):</label>
                <input
                  value={editUser.givenName}
                  onChange={(e) =>
                    setEditUser({ ...editUser, givenName: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div className="col-span-2">
                <label className="text-zinc-400 block mb-1">Иниц.:</label>
                <input
                  value={getAttr('initials', '')}
                  maxLength={6}
                  onChange={(e) => setAttr('initials', e.target.value)}
                  placeholder="А.В."
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 text-center"
                />
              </div>
              <div className="col-span-5">
                <label className="text-zinc-400 block mb-1">Фамилия (sn):</label>
                <input
                  value={editUser.surname}
                  onChange={(e) =>
                    setEditUser({ ...editUser, surname: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">
                Отображаемое имя (displayName):
              </label>
              <input
                value={editUser.displayName}
                onChange={(e) =>
                  setEditUser({ ...editUser, displayName: e.target.value })
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 font-medium"
              />
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">
                Описание (description):
              </label>
              <input
                value={editUser.description}
                onChange={(e) =>
                  setEditUser({ ...editUser, description: e.target.value })
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-zinc-800/80">
              <div>
                <label className="text-zinc-400 block mb-1">
                  Комната / Офис (physicalDeliveryOfficeName):
                </label>
                <input
                  value={editUser.office}
                  onChange={(e) =>
                    setEditUser({ ...editUser, office: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Табельный номер (employeeID):
                </label>
                <input
                  value={getAttr('employeeID', 'EMP-1001')}
                  onChange={(e) => setAttr('employeeID', e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-zinc-400 block mb-1">
                  Номер телефона (telephoneNumber):
                </label>
                <input
                  value={editUser.telephone}
                  onChange={(e) =>
                    setEditUser({ ...editUser, telephone: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Электронная почта (mail):
                </label>
                <input
                  value={editUser.email}
                  onChange={(e) =>
                    setEditUser({ ...editUser, email: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">
                Веб-страница (wWWHomePage):
              </label>
              <input
                value={getAttr('wWWHomePage', 'https://portal.satella.io')}
                onChange={(e) => setAttr('wWWHomePage', e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100 font-mono"
              />
            </div>
          </div>
        )}

        {/* 2. ADDRESS & TELEPHONES TAB (Адрес и Телефоны) */}
        {tab === 'address' && (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2.5">
              <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-400" />
                Почтовый адрес (Address)
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Улица, дом (streetAddress):
                </label>
                <input
                  value={getAttr('streetAddress', 'Пресненская наб., д. 12, Башня Федерация')}
                  onChange={(e) => setAttr('streetAddress', e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-zinc-400 block mb-1">Город (l):</label>
                  <input
                    value={getAttr('l', editUser.office.includes('SPb') ? 'Санкт-Петербург' : 'Москва')}
                    onChange={(e) => setAttr('l', e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Область (st):</label>
                  <input
                    value={getAttr('st', 'Московская обл.')}
                    onChange={(e) => setAttr('st', e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Индекс (postalCode):</label>
                  <input
                    value={getAttr('postalCode', '123112')}
                    onChange={(e) => setAttr('postalCode', e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Абонентский ящик (postOfficeBox):
                  </label>
                  <input
                    value={getAttr('postOfficeBox', '')}
                    onChange={(e) => setAttr('postOfficeBox', e.target.value)}
                    placeholder="А/Я"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Страна или регион (co):
                  </label>
                  <select
                    value={getAttr('co', 'Россия (RU)')}
                    onChange={(e) => setAttr('co', e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                  >
                    <option value="Россия (RU)">Россия (RU)</option>
                    <option value="Казахстан (KZ)">Казахстан (KZ)</option>
                    <option value="Беларусь (BY)">Беларусь (BY)</option>
                    <option value="Узбекистан (UZ)">Узбекистан (UZ)</option>
                    <option value="США (US)">США (US)</option>
                    <option value="Германия (DE)">Германия (DE)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2.5">
              <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-indigo-400" />
                Телефоны и заметки (Telephones)
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Мобильный (mobile):
                  </label>
                  <input
                    value={editUser.mobile || editUser.telephone}
                    onChange={(e) =>
                      setEditUser({ ...editUser, mobile: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Внутренний IP-телефон (ipPhone):
                  </label>
                  <input
                    value={getAttr('ipPhone', 'SIP: 4102')}
                    onChange={(e) => setAttr('ipPhone', e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Домашний (homePhone):
                  </label>
                  <input
                    value={getAttr('homePhone', '')}
                    onChange={(e) => setAttr('homePhone', e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Факс (facsimileTelephoneNumber):
                  </label>
                  <input
                    value={getAttr('facsimileTelephoneNumber', '')}
                    onChange={(e) =>
                      setAttr('facsimileTelephoneNumber', e.target.value)
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                  />
                </div>
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Заметки администратора (info / comment):
                </label>
                <textarea
                  rows={2}
                  value={getAttr('info', `Сотрудник подразделения ${editUser.department}. Выдан пропуск и токен.`)}
                  onChange={(e) => setAttr('info', e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
            </div>
          </div>
        )}

        {/* 3. ACCOUNT TAB (Учётная запись — 1:1 как в dsa.msc) */}
        {tab === 'account' && (
          <div className="space-y-3.5">
            {/* UPN & pre-Win2000 logon names */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2.5">
              <div>
                <label className="text-zinc-400 block mb-1">
                  Имя входа пользователя (userPrincipalName):
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    value={upnPrefix}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        userPrincipalName: `${e.target.value}@${upnSuffix}`,
                      })
                    }
                    className="col-span-6 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-zinc-100"
                  />
                  <select
                    value={upnSuffix}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        userPrincipalName: `${upnPrefix}@${e.target.value}`,
                      })
                    }
                    className="col-span-6 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-zinc-200"
                  >
                    <option value="corp.satella.local">@corp.satella.local</option>
                    <option value="satella.io">@satella.io</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">
                  Имя входа пользователя (пред-Windows 2000 / sAMAccountName):
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    readOnly
                    value="CORP\"
                    className="col-span-4 rounded-lg border border-zinc-800/70 bg-zinc-950/60 px-2.5 py-1.5 font-mono text-zinc-400"
                  />
                  <input
                    value={editUser.samAccountName}
                    onChange={(e) =>
                      setEditUser({ ...editUser, samAccountName: e.target.value })
                    }
                    className="col-span-8 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-zinc-100"
                  />
                </div>
              </div>

              {/* Logon Hours & Logon To buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowLogonHoursModal((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
                  >
                    <Clock className="h-3.5 w-3.5 text-indigo-400" />
                    Время входа... (Logon Hours)
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowWorkstationsModal((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-700"
                  >
                    <Monitor className="h-3.5 w-3.5 text-indigo-400" />
                    Вход на компьютеры... (Logon To)
                  </button>
                </div>
                <span className="text-[11px] text-zinc-400 font-mono">
                  {getAttr('userWorkstations')
                    ? `ПК: ${getAttr('userWorkstations')}`
                    : 'Все компьютеры'}
                </span>
              </div>

              {/* Interactive Logon Hours 7x24 Matrix */}
              {showLogonHoursModal && (
                <div className="rounded-xl border border-indigo-500/30 bg-zinc-950 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-200">
                      Разрешённые часы входа в сеть Active Directory (24×7):
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLogonMatrix(
                            Array.from({ length: 7 }, () =>
                              Array.from({ length: 24 }, () => true)
                            )
                          );
                          setAttr('logonHours', '24x7 (Все часы разрешены)');
                        }}
                        className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-200 hover:bg-zinc-700"
                      >
                        Разрешить 24/7
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setLogonMatrix(
                            Array.from({ length: 7 }, (_, d) =>
                              Array.from(
                                { length: 24 },
                                (__, h) => d < 5 && h >= 8 && h < 20
                              )
                            )
                          );
                          setAttr('logonHours', 'Пн-Пт 08:00-20:00');
                        }}
                        className="rounded bg-indigo-600/30 border border-indigo-500/40 px-2 py-0.5 text-[10px] text-indigo-200"
                      >
                        Только будни 08:00–20:00
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {DAYS_OF_WEEK.map((day, dIdx) => (
                      <div key={day} className="flex items-center gap-1">
                        <span className="w-6 text-[10px] font-mono text-zinc-400">
                          {day}
                        </span>
                        <div className="grid grid-cols-24 gap-0.5 flex-1">
                          {logonMatrix[dIdx].map((allowed, hIdx) => (
                            <div
                              key={hIdx}
                              onClick={() => {
                                const copy = logonMatrix.map((r) => [...r]);
                                copy[dIdx][hIdx] = !copy[dIdx][hIdx];
                                setLogonMatrix(copy);
                                setAttr('logonHours', 'Custom Schedule');
                              }}
                              title={`${day} ${hIdx}:00 - ${hIdx + 1}:00 (${
                                allowed ? 'Вход разрешён' : 'Вход запрещён'
                              })`}
                              className={`h-3.5 rounded-sm cursor-pointer transition ${
                                allowed
                                  ? 'bg-emerald-500/80 hover:bg-emerald-400'
                                  : 'bg-zinc-800 hover:bg-zinc-700'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Logon To Workstations Panel */}
              {showWorkstationsModal && (
                <div className="rounded-xl border border-indigo-500/30 bg-zinc-950 p-3 space-y-2">
                  <div className="text-zinc-200 font-semibold">
                    Ограничение рабочих станций для входа (userWorkstations):
                  </div>
                  <div className="flex gap-4 text-zinc-300">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!getAttr('userWorkstations')}
                        onChange={() => setAttr('userWorkstations', '')}
                      />
                      Все компьютеры домена
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        checked={!!getAttr('userWorkstations')}
                        onChange={() =>
                          setAttr('userWorkstations', 'WS-ENG-014,WS-FIN-101')
                        }
                      />
                      Только следующие компьютеры (NetBIOS через запятую):
                    </label>
                  </div>
                  {getAttr('userWorkstations') && (
                    <input
                      value={getAttr('userWorkstations')}
                      onChange={(e) => setAttr('userWorkstations', e.target.value)}
                      placeholder="WS-ENG-014,WS-ENG-022"
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 font-mono text-zinc-100"
                    />
                  )}
                </div>
              )}
            </div>

            {/* Unlock Account Checkbox */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3.5 py-2.5 flex items-center justify-between">
              <label className="flex items-center gap-2 text-zinc-200 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={!editUser.lockedOut}
                  onChange={(e) =>
                    setEditUser({ ...editUser, lockedOut: !e.target.checked })
                  }
                />
                Разблокировать учётную запись (Unlock account)
              </label>
              <span className="text-[11px] text-zinc-400">
                {editUser.lockedOut
                  ? '⚠️ Сейчас заблокирована (badPwdCount >= 5)'
                  : 'Аккаунт не заблокирован'}
              </span>
            </div>

            {/* Account Options (UAC Checkboxes list like dsa.msc) */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2">
              <div className="font-semibold text-zinc-200">
                Параметры учётной записи (Account options — флаги userAccountControl):
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-lg border border-zinc-800 bg-zinc-950 p-2.5">
                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editUser.mustChangePasswordNextLogon}
                    onChange={(e) =>
                      setEditUser({
                        ...editUser,
                        mustChangePasswordNextLogon: e.target.checked,
                      })
                    }
                  />
                  Требовать смену пароля при следующем входе в систему
                </label>

                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getBoolAttr('uac_cannotChangePassword')}
                    onChange={(e) =>
                      setBoolAttr('uac_cannotChangePassword', e.target.checked)
                    }
                  />
                  Запретить смену пароля пользователем (User cannot change password)
                </label>

                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
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
                  Срок действия пароля не ограничен (Password never expires)
                </label>

                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getBoolAttr('uac_reversibleEncryption')}
                    onChange={(e) =>
                      setBoolAttr('uac_reversibleEncryption', e.target.checked)
                    }
                  />
                  Хранить пароль с использованием обратимого шифрования
                </label>

                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!editUser.enabled}
                    onChange={(e) =>
                      setEditUser({ ...editUser, enabled: !e.target.checked })
                    }
                  />
                  Учётная запись отключена (Account is disabled)
                </label>

                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getBoolAttr('uac_smartcardRequired')}
                    onChange={(e) =>
                      setBoolAttr('uac_smartcardRequired', e.target.checked)
                    }
                  />
                  Требовать смарт-карту для интерактивного входа в систему
                </label>

                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getBoolAttr('uac_notDelegated')}
                    onChange={(e) =>
                      setBoolAttr('uac_notDelegated', e.target.checked)
                    }
                  />
                  Учётная запись чувствительна и не может быть делегирована
                </label>

                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getBoolAttr('uac_useAesEncryption', true)}
                    onChange={(e) =>
                      setBoolAttr('uac_useAesEncryption', e.target.checked)
                    }
                  />
                  Эта учётная запись поддерживает шифрование Kerberos AES 128/256 бит
                </label>

                <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={getBoolAttr('uac_dontRequirePreauth')}
                    onChange={(e) =>
                      setBoolAttr('uac_dontRequirePreauth', e.target.checked)
                    }
                  />
                  Не требовать предварительной проверки подлинности Kerberos
                </label>
              </div>
            </div>

            {/* Account Expires */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2">
              <div className="font-semibold text-zinc-200">
                Срок действия учётной записи (Account expires):
              </div>
              <div className="flex flex-wrap items-center gap-5">
                <label className="flex items-center gap-1.5 text-zinc-200 cursor-pointer">
                  <input
                    type="radio"
                    checked={!getAttr('accountExpiresDate')}
                    onChange={() => setAttr('accountExpiresDate', '')}
                  />
                  Никогда (Never)
                </label>
                <label className="flex items-center gap-1.5 text-zinc-200 cursor-pointer">
                  <input
                    type="radio"
                    checked={!!getAttr('accountExpiresDate')}
                    onChange={() => setAttr('accountExpiresDate', '2026-12-31')}
                  />
                  Конец дня (End of):
                </label>
                <input
                  type="date"
                  disabled={!getAttr('accountExpiresDate')}
                  value={getAttr('accountExpiresDate', '')}
                  onChange={(e) => setAttr('accountExpiresDate', e.target.value)}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-zinc-100 disabled:opacity-40"
                />
              </div>
            </div>
          </div>
        )}

        {/* 4. PROFILE TAB (Профиль — profilePath, scriptPath, Home Folder) */}
        {tab === 'profile' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <div className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                <FolderKanban className="h-3.5 w-3.5 text-indigo-400" />
                Профиль пользователя (User profile)
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Путь к перемещаемому профилю (profilePath):
                </label>
                <div className="flex gap-2">
                  <input
                    value={getAttr('profilePath', '')}
                    onChange={(e) => setAttr('profilePath', e.target.value)}
                    placeholder={`\\\\fs01.corp.satella.local\\profiles\\${editUser.samAccountName}`}
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-zinc-100"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setAttr(
                        'profilePath',
                        `\\\\fs01.corp.satella.local\\profiles\\${editUser.samAccountName}`
                      )
                    }
                    className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700"
                  >
                    Авто-путь
                  </button>
                </div>
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Сценарий входа (scriptPath — в папке NETLOGON):
                </label>
                <input
                  value={getAttr('scriptPath', 'logon_corp.bat')}
                  onChange={(e) => setAttr('scriptPath', e.target.value)}
                  placeholder="logon.bat или mount_shares.ps1"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-zinc-100"
                />
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 space-y-3">
              <div className="text-xs font-semibold text-zinc-200">
                Домашняя папка (Home folder)
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 w-36 text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={!getAttr('homeDrive', 'H:')}
                      onChange={() => setAttr('homeDrive', '')}
                    />
                    Локальный путь:
                  </label>
                  <input
                    disabled={!!getAttr('homeDrive', 'H:')}
                    value={getAttr('localHomePath', '')}
                    onChange={(e) => setAttr('localHomePath', e.target.value)}
                    placeholder="C:\Users\..."
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-zinc-100 disabled:opacity-40"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 w-36 text-zinc-300 cursor-pointer">
                    <input
                      type="radio"
                      checked={!!getAttr('homeDrive', 'H:')}
                      onChange={() => setAttr('homeDrive', 'H:')}
                    />
                    Подключить:
                  </label>
                  <select
                    value={getAttr('homeDrive', 'H:')}
                    onChange={(e) => setAttr('homeDrive', e.target.value)}
                    className="rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-zinc-100"
                  >
                    {DRIVE_LETTERS.map((drv) => (
                      <option key={drv} value={drv}>
                        {drv}
                      </option>
                    ))}
                  </select>
                  <span className="text-zinc-400">к:</span>
                  <input
                    value={getAttr(
                      'homeDirectory',
                      `\\\\fs01.corp.satella.local\\profiles\\${editUser.samAccountName}`
                    )}
                    onChange={(e) => setAttr('homeDirectory', e.target.value)}
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-zinc-100"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 5. ORGANIZATION TAB (Организация — Должность, Руководитель, Прямые подчинённые) */}
        {tab === 'organization' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-zinc-400 block mb-1">
                  Должность (title):
                </label>
                <input
                  value={editUser.title}
                  onChange={(e) =>
                    setEditUser({ ...editUser, title: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Отдел / Департамент (department):
                </label>
                <input
                  value={editUser.department}
                  onChange={(e) =>
                    setEditUser({ ...editUser, department: e.target.value })
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
                />
              </div>
            </div>

            <div>
              <label className="text-zinc-400 block mb-1">
                Организация / Компания (company):
              </label>
              <input
                value={editUser.company}
                onChange={(e) =>
                  setEditUser({ ...editUser, company: e.target.value })
                }
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-zinc-100"
              />
            </div>

            {/* Manager Selector */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2">
              <div className="font-semibold text-zinc-200 flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
                Руководитель (Manager):
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={currentManager?.distinguishedName || editUser.managerDn || ''}
                  onChange={(e) => {
                    setEditUser({ ...editUser, managerDn: e.target.value });
                    setAttr('manager', e.target.value);
                  }}
                  className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                >
                  <option value="">— Руководитель не назначен —</option>
                  {allUsers
                    .filter((u) => u.id !== editUser.id)
                    .map((u) => (
                      <option key={u.id} value={u.distinguishedName}>
                        {u.displayName} — {u.title} ({u.department})
                      </option>
                    ))}
                </select>
                {currentManager && onOpenUserWindow && (
                  <button
                    type="button"
                    onClick={() => onOpenUserWindow(currentManager)}
                    className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] text-indigo-300 hover:bg-zinc-700"
                  >
                    <ExternalLink className="h-3 w-3" /> Свойства
                  </button>
                )}
                {(editUser.managerDn || getAttr('manager')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditUser({ ...editUser, managerDn: '' });
                      setAttr('manager', '');
                    }}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    Очистить
                  </button>
                )}
              </div>
            </div>

            {/* Direct Reports List */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-200">
                  Прямые подчинённые (Direct reports — {directReports.length}):
                </span>
                <span className="text-[11px] text-zinc-400">
                  Сотрудники отдела {editUser.department}:{' '}
                  {
                    allUsers.filter(
                      (u) =>
                        u.id !== editUser.id &&
                        u.department === editUser.department
                    ).length
                  }
                </span>
              </div>
              <div className="max-h-36 overflow-y-auto divide-y divide-zinc-800/60 rounded-lg border border-zinc-800 bg-zinc-950">
                {allUsers
                  .filter(
                    (u) =>
                      u.id !== editUser.id &&
                      (directReports.some((d) => d.id === u.id) ||
                        u.department === editUser.department)
                  )
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-zinc-900/60"
                    >
                      <div>
                        <div className="font-medium text-zinc-200">
                          {sub.displayName}{' '}
                          <span className="text-zinc-500 font-mono">
                            ({sub.samAccountName})
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {sub.title} • {sub.department}
                        </div>
                      </div>
                      {onOpenUserWindow && (
                        <button
                          type="button"
                          onClick={() => onOpenUserWindow(sub)}
                          className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] text-zinc-200 hover:bg-zinc-700"
                        >
                          Открыть карточку
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* 6. MEMBER OF TAB (Членство в группах + Сравнение доступов) */}
        {tab === 'groups' && (
          <div className="space-y-3">
            {/* Search & "Only Active Groups" Checkbox + Copy from Colleague + Compare Toggle */}
            <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={groupSearch}
                    onChange={(e) => setGroupSearch(e.target.value)}
                    placeholder="Поиск группы по названию или описанию (VPN, 1C, GitLab, Admins)..."
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-8 pr-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowCompareMode((v) => !v)}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                    showCompareMode
                      ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  Сравнить с коллегой
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
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
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-[11px] text-zinc-300"
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

            {showCompareMode ? (
              <div className="space-y-2.5">
                <div className="rounded-xl border border-indigo-500/30 bg-zinc-900/60 p-3 flex items-center justify-between gap-3">
                  <span className="text-zinc-300 font-medium">
                    Эталонный сотрудник для сравнения прав:
                  </span>
                  <select
                    value={compareUserId}
                    onChange={(e) => setCompareUserId(e.target.value)}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-zinc-100"
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
                  <div className="space-y-1.5">
                    {groups.map((g) => {
                      const hasA = editUser.memberOf.some(
                        (m) =>
                          m.toLowerCase() === g.distinguishedName.toLowerCase()
                      );
                      const hasB = compareUser.memberOf.some(
                        (m) =>
                          m.toLowerCase() === g.distinguishedName.toLowerCase()
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
            ) : (
              <>
                {/* Filtered Group List */}
                <div className="space-y-1.5">
                  {filteredGroups.length === 0 ? (
                    <div className="py-6 text-center text-zinc-500">
                      Группы по заданному фильтру не найдены
                    </div>
                  ) : (
                    filteredGroups.map((g) => {
                      const isMember = editUser.memberOf.some(
                        (m) =>
                          m.toLowerCase() === g.distinguishedName.toLowerCase()
                      );
                      return (
                        <label
                          key={g.id}
                          className={`flex items-center justify-between rounded-xl border p-2.5 cursor-pointer transition ${
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
                                <Shield className="h-3.5 w-3.5 text-amber-400" />
                                {g.displayName}
                                <span className="text-[10px] font-mono text-zinc-500">
                                  ({g.groupCategory} / {g.groupScope})
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-400">
                                {g.description}
                              </div>
                            </div>
                          </div>
                          {isMember && (
                            <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                              Член группы
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>

                {/* Primary Group Footer like dsa.msc */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 px-3.5 py-2.5 flex items-center justify-between">
                  <div>
                    <span className="text-zinc-400">Основная группа (Primary group): </span>
                    <span className="font-semibold text-zinc-200">
                      {getAttr('primaryGroup', 'Domain Users (Пользователи домена)')}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">
                    primaryGroupID: 513
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* 7. REMOTE DESKTOP / SESSIONS TAB (Сеансы RDP, Среда, Теневое управление) */}
        {tab === 'rdp' && (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2.5">
              <div className="font-semibold text-zinc-200">
                Профиль служб удалённых рабочих столов (Remote Desktop Services Profile)
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Путь к профилю RDS (msTSProfilePath):
                </label>
                <input
                  value={getAttr(
                    'msTSProfilePath',
                    `\\\\srv-1c-app.corp.satella.local\\rds_profiles\\${editUser.samAccountName}`
                  )}
                  onChange={(e) => setAttr('msTSProfilePath', e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-zinc-100"
                />
              </div>
              <label className="flex items-center gap-2 text-zinc-200 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={getBoolAttr('msTSAllowLogon', true)}
                  onChange={(e) => setBoolAttr('msTSAllowLogon', e.target.checked)}
                />
                Разрешить пользователю вход на сервер узла сеансов удалённых рабочих столов
              </label>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2.5">
              <div className="font-semibold text-zinc-200">
                Ограничения времени сеанса (Sessions Timeouts)
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Отключённый сеанс:
                  </label>
                  <select
                    value={getAttr('rdsMaxDisconnectionTime', '8 часов')}
                    onChange={(e) =>
                      setAttr('rdsMaxDisconnectionTime', e.target.value)
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  >
                    <option value="Никогда">Никогда</option>
                    <option value="1 час">1 час</option>
                    <option value="8 часов">8 часов</option>
                    <option value="24 часа">24 часа</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Активный сеанс:
                  </label>
                  <select
                    value={getAttr('rdsMaxConnectionTime', 'Никогда')}
                    onChange={(e) =>
                      setAttr('rdsMaxConnectionTime', e.target.value)
                    }
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  >
                    <option value="Никогда">Никогда</option>
                    <option value="12 часов">12 часов</option>
                    <option value="24 часа">24 часа</option>
                  </select>
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">
                    Бездействие (Idle):
                  </label>
                  <select
                    value={getAttr('rdsMaxIdleTime', '3 часа')}
                    onChange={(e) => setAttr('rdsMaxIdleTime', e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-zinc-100"
                  >
                    <option value="Никогда">Никогда</option>
                    <option value="30 минут">30 минут</option>
                    <option value="3 часа">3 часа</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2">
              <div className="font-semibold text-zinc-200">
                Удалённое управление (Remote Control / Shadow RDP)
              </div>
              <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getBoolAttr('rdsEnableRemoteControl', true)}
                  onChange={(e) =>
                    setBoolAttr('rdsEnableRemoteControl', e.target.checked)
                  }
                />
                Разрешить удалённое управление сеансом пользователя (Shadow RDP)
              </label>
              <label className="flex items-center gap-2 text-zinc-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={getBoolAttr('rdsRequirePermission', false)}
                  onChange={(e) =>
                    setBoolAttr('rdsRequirePermission', e.target.checked)
                  }
                />
                Требовать разрешение пользователя на подключение
              </label>
              <div className="pt-1">
                <label className="text-zinc-400 block mb-1">
                  Уровень взаимодействия:
                </label>
                <select
                  value={getAttr(
                    'rdsControlLevel',
                    'Взаимодействие с сеансом (Полное управление)'
                  )}
                  onChange={(e) => setAttr('rdsControlLevel', e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-zinc-100"
                >
                  <option value="Просмотр сеанса пользователя (View Only)">
                    Просмотр сеанса пользователя (View Only)
                  </option>
                  <option value="Взаимодействие с сеансом (Полное управление)">
                    Взаимодействие с сеансом (Полное управление)
                  </option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* 8. OBJECT & ATTRIBUTE EDITOR TAB (Объект и Атрибуты LDAP) */}
        {tab === 'ldap' && (
          <div className="space-y-3.5">
            {/* Object Metadata Box (Вкладка «Объект» из dsa.msc) */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2">
              <div className="font-semibold text-zinc-200">
                Сведения об объекте каталога (Object Metadata)
              </div>
              <div>
                <label className="text-zinc-400 block mb-1">
                  Каноническое имя объекта (Canonical name of object):
                </label>
                <div className="flex gap-1.5">
                  <input
                    readOnly
                    value={canonicalName}
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-[11px] text-zinc-300"
                  />
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(canonicalName)}
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-zinc-400 hover:text-zinc-200"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">
                  Distinguished Name (DN):
                </label>
                <div className="flex gap-1.5">
                  <input
                    readOnly
                    value={editUser.distinguishedName}
                    className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 font-mono text-[11px] text-zinc-300"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      navigator.clipboard.writeText(editUser.distinguishedName)
                    }
                    className="rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 text-zinc-400 hover:text-zinc-200"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                  <div className="text-zinc-500">Класс объекта</div>
                  <div className="font-mono text-zinc-200 mt-0.5">user</div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                  <div className="text-zinc-500">Создан (whenCreated)</div>
                  <div className="font-mono text-zinc-200 mt-0.5">
                    {new Date(editUser.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-2">
                  <div className="text-zinc-500">Последний вход</div>
                  <div className="font-mono text-zinc-200 mt-0.5">
                    {editUser.lastLogon
                      ? new Date(editUser.lastLogon).toLocaleString()
                      : '—'}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-zinc-200 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={getBoolAttr('protectedFromAccidentalDeletion', true)}
                  onChange={(e) =>
                    setBoolAttr(
                      'protectedFromAccidentalDeletion',
                      e.target.checked
                    )
                  }
                />
                Защитить объект от случайного удаления (Protect object from accidental deletion)
              </label>
            </div>

            {/* Full LDAP Attribute Editor */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-300">
                  <Code2 className="h-3.5 w-3.5" /> Редактор атрибутов (LDAP Attribute Editor)
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyFilledAttrs}
                    onChange={(e) => setOnlyFilledAttrs(e.target.checked)}
                  />
                  Только имеющие значения
                </label>
              </div>

              <input
                value={attrSearch}
                onChange={(e) => setAttrSearch(e.target.value)}
                placeholder="Фильтр по названию атрибута (например: objectSid, userAccountControl, homeDrive)..."
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
              />

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                {Object.entries(editUser.customAttributes || {})
                  .filter(([k, v]) => {
                    if (onlyFilledAttrs && !v) return false;
                    if (!attrSearch.trim()) return true;
                    return (
                      k.toLowerCase().includes(attrSearch.toLowerCase()) ||
                      v.toLowerCase().includes(attrSearch.toLowerCase())
                    );
                  })
                  .map(([k, v]) => (
                    <div
                      key={k}
                      className="grid grid-cols-5 gap-2 items-center rounded-lg border border-zinc-800/80 bg-zinc-950 px-2.5 py-1.5"
                    >
                      <span className="col-span-2 font-mono text-[11px] text-zinc-400 truncate">
                        {k}
                      </span>
                      <input
                        value={v}
                        onChange={(e) => setAttr(k, e.target.value)}
                        className="col-span-3 rounded bg-zinc-900 border border-zinc-800 px-2 py-1 font-mono text-[11px] text-emerald-300"
                      />
                    </div>
                  ))}
              </div>

              <div className="border-t border-zinc-800 pt-2.5">
                <div className="text-[11px] text-zinc-400 mb-1.5">
                  Добавить атрибут схемы AD (extensionAttribute1..15, msNPAllowDialin и др.):
                </div>
                <div className="flex gap-1.5">
                  <input
                    placeholder="extensionAttribute1"
                    value={newAttrKey}
                    onChange={(e) => setNewAttrKey(e.target.value)}
                    className="w-1/2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-[11px]"
                  />
                  <input
                    placeholder="Значение"
                    value={newAttrVal}
                    onChange={(e) => setNewAttrVal(e.target.value)}
                    className="w-1/2 rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-1 font-mono text-[11px]"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newAttrKey.trim()) {
                        setAttr(newAttrKey.trim(), newAttrVal);
                        setNewAttrKey('');
                        setNewAttrVal('');
                      }
                    }}
                    className="rounded-lg bg-zinc-800 px-3 text-zinc-200 hover:bg-zinc-700"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Classic AD Property Sheet Footer: OK | Cancel | Apply */}
      <div className="border-t border-zinc-800 px-4 py-2.5 bg-zinc-900 flex items-center justify-between">
        <span className="text-[11px] text-zinc-400 font-mono truncate max-w-[260px]">
          SID: {getAttr('objectSid', 'S-1-5-21-...')}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleSave(true)}
            className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500 transition"
          >
            <Check className="h-3.5 w-3.5" /> ОК
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 transition"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            className="flex items-center gap-1 rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3.5 py-1.5 text-xs font-semibold text-indigo-300 hover:bg-indigo-500/25 transition"
          >
            <Save className="h-3.5 w-3.5" /> Применить
          </button>
        </div>
      </div>
    </div>
  );
};
