import React, { useEffect, useState } from 'react';
import {
  Search,
  User,
  Monitor,
  Shield,
  Unlock,
  Terminal,
  Sparkles,
  History,
  CornerDownLeft,
  X,
} from 'lucide-react';
import type { AdComputer, AdGroup, AdUser } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  users: AdUser[];
  computers: AdComputer[];
  groups: AdGroup[];
  onSelectUser: (user: AdUser) => void;
  onSelectComputer: (comp: AdComputer) => void;
  onUnlockUser: (userId: string) => void;
  onNavigate: (tab: string) => void;
  onOpenPsDrawer: () => void;
}

export const CommandPalette: React.FC<Props> = ({
  open,
  onClose,
  users,
  computers,
  groups,
  onSelectUser,
  onSelectComputer,
  onUnlockUser,
  onNavigate,
  onOpenPsDrawer,
}) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) setQuery('');
  }, [open]);

  if (!open) return null;

  const q = query.trim().toLowerCase();

  const matchedUsers = users
    .filter(
      (u) =>
        !q ||
        u.displayName.toLowerCase().includes(q) ||
        u.samAccountName.toLowerCase().includes(q) ||
        u.department.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q)
    )
    .slice(0, 5);

  const matchedComputers = computers
    .filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.ipAddress.toLowerCase().includes(q) ||
        c.loggedOnUser.toLowerCase().includes(q)
    )
    .slice(0, 4);

  const matchedGroups = groups
    .filter(
      (g) =>
        !q ||
        g.displayName.toLowerCase().includes(q) ||
        g.description.toLowerCase().includes(q)
    )
    .slice(0, 3);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-sm pt-20"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3.5">
          <Search className="h-4 w-4 text-indigo-400 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Быстрый поиск юзера, ПК, IP, группы или команды (например: volkov, 10.20, WS-FIN)..."
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded border border-zinc-800 bg-zinc-900 px-1.5 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
          >
            ESC
          </button>
        </div>

        <div className="max-h-[440px] overflow-y-auto p-2 space-y-4">
          {/* Quick Actions */}
          <div>
            <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Быстрые переходы и команды
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
              <button
                onClick={() => {
                  onNavigate('automation');
                  onClose();
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-900 transition"
              >
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>Онбординг нового сотрудника по шаблону</span>
              </button>
              <button
                onClick={() => {
                  onNavigate('audit');
                  onClose();
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-900 transition"
              >
                <History className="h-4 w-4 text-amber-400" />
                <span>Журнал Rollback и Корзина AD</span>
              </button>
              <button
                onClick={() => {
                  onOpenPsDrawer();
                  onClose();
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-900 transition"
              >
                <Terminal className="h-4 w-4 text-emerald-400" />
                <span>Открыть генератор кода PowerShell</span>
              </button>
              <button
                onClick={() => {
                  onNavigate('computers');
                  onClose();
                }}
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-900 transition"
              >
                <Monitor className="h-4 w-4 text-cyan-400" />
                <span>Shadow RDP и Диспетчер задач ПК</span>
              </button>
            </div>
          </div>

          {/* Users */}
          {matchedUsers.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Пользователи Active Directory ({matchedUsers.length})
              </div>
              <div className="space-y-0.5 mt-1">
                {matchedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-zinc-900/90 transition group"
                  >
                    <button
                      onClick={() => {
                        onSelectUser(u);
                        onClose();
                      }}
                      className="flex items-center gap-3 text-left flex-1"
                    >
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-500/15 text-indigo-400 text-xs font-medium">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-100">
                            {u.displayName}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-400">
                            {u.samAccountName}
                          </span>
                          {u.lockedOut && (
                            <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-400">
                              LOCKED
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {u.title} • {u.department}
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5">
                      {u.lockedOut && (
                        <button
                          onClick={() => {
                            onUnlockUser(u.id);
                            onClose();
                          }}
                          className="flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/25"
                        >
                          <Unlock className="h-3 w-3" /> Unlock
                        </button>
                      )}
                      <CornerDownLeft className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Computers */}
          {matchedComputers.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Хосты и серверы ({matchedComputers.length})
              </div>
              <div className="space-y-0.5 mt-1">
                {matchedComputers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      onSelectComputer(c);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-zinc-900/90 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                          c.isOnline
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        <Monitor className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-100 font-mono">
                            {c.name}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-400">
                            {c.ipAddress}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {c.operatingSystem} • Сессия: {c.loggedOnUser || 'Нет'}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-indigo-400">
                      Shadow RDP / WinRM →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Groups */}
          {matchedGroups.length > 0 && (
            <div>
              <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                Группы безопасности ({matchedGroups.length})
              </div>
              <div className="space-y-0.5 mt-1">
                {matchedGroups.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => {
                      onNavigate('directory');
                      onClose();
                    }}
                    className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-zinc-900/90 transition"
                  >
                    <div className="flex items-center gap-3">
                      <Shield className="h-4 w-4 text-amber-400" />
                      <div>
                        <div className="text-xs font-medium text-zinc-100">
                          {g.displayName}
                        </div>
                        <div className="text-[11px] text-zinc-500">
                          {g.description}
                        </div>
                      </div>
                    </div>
                    <span className="text-[11px] text-zinc-400">
                      {g.members.length} участн.
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-900/50 px-4 py-2 text-[11px] text-zinc-500">
          <span>Нажмите на любой объект для мгновенного открытия карточки</span>
          <span>Satella Command Engine v1.0</span>
        </div>
      </div>
    </div>
  );
};

