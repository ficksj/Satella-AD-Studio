import React, { useCallback, useEffect, useState } from 'react';
import {
  LayoutDashboard,
  FolderTree,
  Monitor,
  Sparkles,
  ShieldCheck,
  History,
  Search,
  Terminal,
  Globe,
  CheckCircle2,
  Server,
  User,
  X,
} from 'lucide-react';
import { api } from './api';
import { translations, type Lang } from './i18n';
import type {
  AclRule,
  AdComputer,
  AdGpo,
  AdGroup,
  AdUser,
  AuditActionEntry,
  DashboardStats,
  DhcpLease,
  DnsRecord,
  DomainProfile,
  OnboardingTemplate,
  OuNode,
  RecycleBinObject,
} from './types';
import { CommandPalette } from './components/CommandPalette';
import { PowerShellDrawer } from './components/PowerShellDrawer';
import { DashboardView } from './components/DashboardView';
import { DirectoryExplorerView } from './components/DirectoryExplorerView';
import { ComputersView } from './components/ComputersView';
import { AutomationView } from './components/AutomationView';
import { InfraGpoDnsView } from './components/InfraGpoDnsView';
import { AuditAndRecycleView } from './components/AuditAndRecycleView';
import { UserPropertyWindow } from './components/UserPropertyWindow';
import { PixelMonkeyIcon } from './components/PixelMonkeyIcon';

interface OpenUserWin {
  userId: string;
  minimized: boolean;
  zIndex: number;
}

export const App: React.FC = () => {
  const [lang, setLang] = useState<Lang>('ru');
  const t = translations[lang];

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [psDrawerOpen, setPsDrawerOpen] = useState(false);
  const [latestPsScript, setLatestPsScript] = useState('');
  const [toast, setToast] = useState<{ message: string; hasPs: boolean } | null>(
    null
  );

  // Domain State
  const [profiles, setProfiles] = useState<DomainProfile[]>([]);
  const [activeProfile, setActiveProfile] = useState<DomainProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [ouTree, setOuTree] = useState<OuNode[]>([]);
  const [users, setUsers] = useState<AdUser[]>([]);
  const [groups, setGroups] = useState<AdGroup[]>([]);
  const [computers, setComputers] = useState<AdComputer[]>([]);
  const [templates, setTemplates] = useState<OnboardingTemplate[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditActionEntry[]>([]);
  const [recycleBin, setRecycleBin] = useState<RecycleBinObject[]>([]);
  const [gpos, setGpos] = useState<AdGpo[]>([]);
  const [acls, setAcls] = useState<AclRule[]>([]);
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([]);
  const [dhcpLeases, setDhcpLeases] = useState<DhcpLease[]>([]);

  // Multi-Window User Property Cards (like dsa.msc)
  const [openWindows, setOpenWindows] = useState<OpenUserWin[]>([]);
  const [topZ, setTopZ] = useState<number>(30);

  const [selectedComputer, setSelectedComputer] = useState<AdComputer | null>(
    null
  );

  const showToast = useCallback((message: string, ps?: string) => {
    if (ps) setLatestPsScript(ps);
    setToast({ message, hasPs: !!ps });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4500);
  }, []);

  const refreshAll = useCallback(async () => {
    try {
      const [
        profList,
        actProf,
        dash,
        ous,
        usrList,
        grpList,
        cmpList,
        tplList,
        audList,
        recList,
        gpoList,
        aclList,
        dnsList,
        dhcpList,
      ] = await Promise.all([
        api.getProfiles(),
        api.getActiveProfile(),
        api.getDashboard(),
        api.getOuTree(),
        api.getUsers(),
        api.getGroups(),
        api.getComputers(),
        api.getTemplates(),
        api.getAuditLogs(),
        api.getRecycleBin(),
        api.getGpos(),
        api.getAcls(),
        api.getDns(),
        api.getDhcp(),
      ]);

      setProfiles(profList);
      setActiveProfile(actProf);
      setStats(dash);
      setOuTree(ous);
      setUsers(usrList);
      setGroups(grpList);
      setComputers(cmpList);
      setTemplates(tplList);
      setAuditLogs(audList);
      setRecycleBin(recList);
      setGpos(gpoList);
      setAcls(aclList);
      setDnsRecords(dnsList);
      setDhcpLeases(dhcpList);
    } catch (err) {
      console.error('Failed to load AD state:', err);
    }
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Open or focus a floating User Property Window
  const handleOpenUserWindow = useCallback((user: AdUser) => {
    setTopZ((z) => {
      const nextZ = z + 1;
      setOpenWindows((prev) => {
        const exists = prev.find((w) => w.userId === user.id);
        if (exists) {
          return prev.map((w) =>
            w.userId === user.id
              ? { ...w, minimized: false, zIndex: nextZ }
              : w
          );
        }
        return [
          ...prev,
          { userId: user.id, minimized: false, zIndex: nextZ },
        ];
      });
      return nextZ;
    });
  }, []);

  const handleFocusWindow = (userId: string) => {
    setTopZ((z) => {
      const nextZ = z + 1;
      setOpenWindows((prev) =>
        prev.map((w) => (w.userId === userId ? { ...w, zIndex: nextZ } : w))
      );
      return nextZ;
    });
  };

  const handleCloseWindow = (userId: string) => {
    setOpenWindows((prev) => prev.filter((w) => w.userId !== userId));
  };

  const handleToggleMinimizeWindow = (userId: string) => {
    setOpenWindows((prev) =>
      prev.map((w) =>
        w.userId === userId ? { ...w, minimized: !w.minimized } : w
      )
    );
  };

  // Handlers
  const handleUnlockUser = async (userId: string) => {
    const res = await api.unlockUser(userId);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleResetPassword = async (
    userId: string,
    newPassword: string,
    mustChangeNextLogon: boolean,
    unlockAccount: boolean
  ) => {
    const res = await api.resetPassword({
      userId,
      newPassword,
      mustChangeNextLogon,
      unlockAccount,
    });
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleToggleUserEnabled = async (userId: string, enabled: boolean) => {
    const res = await api.toggleUserEnabled(userId, enabled);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleOffboardUser = async (userId: string) => {
    const res = await api.offboardUser(userId);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleDeleteUser = async (userId: string) => {
    const res = await api.deleteUser(userId);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleCreateUser = async (data: Record<string, unknown>) => {
    const res = await api.createUser(data);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
    if (res.data) handleOpenUserWindow(res.data);
  };

  const handleUpdateUser = async (data: Record<string, unknown>) => {
    const res = await api.updateUser(data);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleBulkAction = async (
    userIds: string[],
    action: string,
    targetOuDn?: string,
    groupDn?: string
  ) => {
    const res = await api.bulkUserAction({
      userIds,
      action,
      targetOuDn,
      groupDn,
    });
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleMoveObject = async (
    objectId: string,
    objectClass: string,
    targetOuDn: string
  ) => {
    const res = await api.moveObject(objectId, objectClass, targetOuDn);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleCreateOu = async (data: {
    name: string;
    parentDn: string;
    description: string;
    protectedFromAccidentalDeletion: boolean;
  }) => {
    const res = await api.createOu(data);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleCreateGroup = async (data: Record<string, unknown>) => {
    const res = await api.createGroup(data);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleRollback = async (auditId: string) => {
    const res = await api.rollbackAction(auditId);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const handleRestoreRecycle = async (recycleId: string) => {
    const res = await api.restoreRecycleBin(recycleId);
    showToast(res.message, res.generatedPowerShell);
    await refreshAll();
  };

  const navItems = [
    { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
    {
      id: 'directory',
      label: t.navDirectory,
      icon: FolderTree,
      badge: stats?.lockedOutUsers ? `${stats.lockedOutUsers} lock` : undefined,
    },
    {
      id: 'computers',
      label: t.navComputers,
      icon: Monitor,
      badge: stats ? `${stats.onlineComputers}/${stats.totalComputers}` : undefined,
    },
    { id: 'automation', label: t.navAutomation, icon: Sparkles },
    { id: 'infra', label: t.navInfra, icon: ShieldCheck },
    {
      id: 'audit',
      label: t.navAudit,
      icon: History,
      badge: recycleBin.length ? `${recycleBin.length}` : undefined,
    },
  ];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#030805] text-zinc-100">
      {/* Top Global Header Bar */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-zinc-800/90 bg-zinc-950 px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-950/60 shadow-md shadow-emerald-500/20 p-1">
            <PixelMonkeyIcon className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold tracking-tight text-emerald-300">
                SATELLA AD
              </span>
              <span className="rounded bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                Сделано командой Crazy Monkeys
              </span>
            </div>
          </div>

          {activeProfile && (
            <div className="ml-4 hidden md:flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/70 px-2.5 py-1 text-xs">
              <Server className="h-3.5 w-3.5 text-emerald-400" />
              <span className="font-mono text-zinc-300">
                {activeProfile.domainName}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-[11px] text-amber-300">
                {activeProfile.isSandbox ? t.sandboxBadge : t.liveAdBadge}
              </span>
            </div>
          )}
        </div>

        {/* Center Command Palette Trigger */}
        <button
          onClick={() => setCmdOpen(true)}
          className="flex w-96 items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 transition"
        >
          <span className="flex items-center gap-2">
            <Search className="h-3.5 w-3.5 text-indigo-400" />
            {t.cmdPaletteHint}
          </span>
          <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
            Ctrl+K
          </kbd>
        </button>

        {/* Right Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPsDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 transition"
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>&lt;/&gt; {t.psInspector}</span>
          </button>

          <button
            onClick={() => setLang((l) => (l === 'ru' ? 'en' : 'ru'))}
            className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
          >
            <Globe className="h-3.5 w-3.5 text-indigo-400" />
            {lang.toUpperCase()}
          </button>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <aside className="w-60 shrink-0 border-r border-zinc-800/90 bg-zinc-950 flex flex-col justify-between p-3">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-300 border border-indigo-500/30'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-indigo-400' : 'text-zinc-500'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                        item.id === 'directory'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Bottom Domain Status & Crazy Monkeys Signature Card */}
          <div className="rounded-xl border border-emerald-500/30 bg-zinc-900/60 p-3 space-y-2 text-[11px]">
            <div className="flex items-center gap-2 border-b border-zinc-800 pb-2">
              <PixelMonkeyIcon className="h-6 w-6 shrink-0" />
              <div>
                <div className="font-bold text-emerald-300 text-xs">
                  Crazy Monkeys
                </div>
                <div className="text-[10px] text-zinc-400">
                  Сделано командой Crazy Monkeys
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-zinc-400">
              <span>Статус LDAPS / WinRM</span>
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Connected
              </span>
            </div>
            <div className="font-mono text-[10px] text-zinc-400 truncate">
              {activeProfile?.dcHost || 'srv-dc-01.corp.satella.local'}
            </div>
            <div className="text-[10px] text-zinc-500">
              Открыто карточек AD: {openWindows.length}
            </div>
          </div>
        </aside>

        {/* Active View Content */}
        <main className="flex-1 overflow-hidden bg-[#030805] relative">
          {activeTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              profiles={profiles}
              activeProfile={activeProfile}
              onUnlockUser={handleUnlockUser}
              onSelectUser={handleOpenUserWindow}
              onSelectComputer={(c) => {
                setSelectedComputer(c);
                setActiveTab('computers');
              }}
              onRollback={handleRollback}
              onSwitchProfile={async (id) => {
                const res = await api.switchProfile(id);
                showToast(res.message);
                await refreshAll();
              }}
              onSaveProfile={async (prof, pwd) => {
                const res = await api.saveProfile(prof, pwd);
                showToast(res.message);
                await refreshAll();
              }}
              onResetSandbox={async () => {
                const res = await api.resetSandbox();
                showToast(res.message);
                await refreshAll();
              }}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'directory' && (
            <DirectoryExplorerView
              ouTree={ouTree}
              users={users}
              groups={groups}
              openUserIds={openWindows.map((w) => w.userId)}
              onOpenUserWindow={handleOpenUserWindow}
              onCreateOu={handleCreateOu}
              onMoveObject={handleMoveObject}
              onCreateUser={handleCreateUser}
              onResetPassword={handleResetPassword}
              onUnlockUser={handleUnlockUser}
              onBulkAction={handleBulkAction}
              onCreateGroup={handleCreateGroup}
            />
          )}

          {activeTab === 'computers' && (
            <ComputersView
              computers={computers}
              selectedComputer={selectedComputer}
              onSelectComputer={setSelectedComputer}
              onLaunchRemoteSession={async (cid, sid, proto, ctrl) => {
                const res = await api.launchRemoteSession(cid, sid, proto, ctrl);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onPowerAction={async (cid, act, reason) => {
                const res = await api.powerComputer(cid, act, reason);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onNotify={(msg, ps) => {
                showToast(msg, ps);
                refreshAll();
              }}
            />
          )}

          {activeTab === 'automation' && (
            <AutomationView
              templates={templates}
              ouTree={ouTree}
              groups={groups}
              onSaveTemplate={async (tpl) => {
                const res = await api.saveTemplate(tpl);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onDeleteTemplate={async (id) => {
                const res = await api.deleteTemplate(id);
                showToast(res.message);
                await refreshAll();
              }}
              onExecuteOnboarding={async (req) => {
                const res = await api.executeOnboarding(req);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
                if (res.data) {
                  handleOpenUserWindow(res.data);
                }
              }}
            />
          )}

          {activeTab === 'infra' && (
            <InfraGpoDnsView
              gpos={gpos}
              ouTree={ouTree}
              groups={groups}
              acls={acls}
              dnsRecords={dnsRecords}
              dhcpLeases={dhcpLeases}
              onSaveGpo={async (gpo) => {
                const res = await api.saveGpo(gpo);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onDeleteGpo={async (id) => {
                const res = await api.deleteGpo(id);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onToggleGpoLink={async (gpoId, ouDn, enabled, enforced) => {
                const res = await api.toggleGpoLink(
                  gpoId,
                  ouDn,
                  enabled,
                  enforced
                );
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onRunGpUpdate={async (target) => {
                const res = await api.runGpUpdate(target);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onCreateAcl={async (req) => {
                const res = await api.createAcl(req);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onCreateDns={async (req) => {
                const res = await api.createDns(req);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onDeleteDns={async (id) => {
                const res = await api.deleteDns(id);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
              onReserveDhcp={async (id) => {
                const res = await api.reserveDhcp(id);
                showToast(res.message, res.generatedPowerShell);
                await refreshAll();
              }}
            />
          )}

          {activeTab === 'audit' && (
            <AuditAndRecycleView
              auditLogs={auditLogs}
              recycleBin={recycleBin}
              onRollback={handleRollback}
              onRestoreRecycle={handleRestoreRecycle}
            />
          )}
        </main>
      </div>

      {/* Multi-Window Floating User Property Cards (like Active Directory dsa.msc) */}
      {openWindows.map((win, idx) => {
        const u = users.find((x) => x.id === win.userId);
        if (!u) return null;
        return (
          <UserPropertyWindow
            key={win.userId}
            user={u}
            allUsers={users}
            groups={groups}
            index={idx}
            zIndex={win.zIndex}
            minimized={win.minimized}
            onFocus={() => handleFocusWindow(win.userId)}
            onClose={() => handleCloseWindow(win.userId)}
            onToggleMinimize={() => handleToggleMinimizeWindow(win.userId)}
            onUpdateUser={handleUpdateUser}
            onResetPassword={handleResetPassword}
            onUnlockUser={handleUnlockUser}
            onToggleUserEnabled={handleToggleUserEnabled}
            onOffboardUser={handleOffboardUser}
            onDeleteUser={handleDeleteUser}
          />
        );
      })}

      {/* Bottom Taskbar for Open / Minimized User Cards */}
      {openWindows.length > 0 && (
        <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950 px-4 py-1.5 z-40">
          <div className="flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-medium text-zinc-500 mr-1">
              Открытые карточки ({openWindows.length}):
            </span>
            {openWindows.map((win) => {
              const u = users.find((x) => x.id === win.userId);
              if (!u) return null;
              return (
                <div
                  key={win.userId}
                  onClick={() => {
                    if (win.minimized) handleToggleMinimizeWindow(win.userId);
                    handleFocusWindow(win.userId);
                  }}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs cursor-pointer transition ${
                    win.minimized
                      ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                      : 'border-indigo-500/40 bg-indigo-500/15 text-indigo-200'
                  }`}
                >
                  <User className="h-3 w-3 text-indigo-400" />
                  <span className="truncate max-w-[150px] font-medium">
                    {u.displayName}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseWindow(win.userId);
                    }}
                    className="text-zinc-400 hover:text-rose-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>

          <button
            onClick={() => setOpenWindows([])}
            className="text-[11px] text-zinc-500 hover:text-rose-400 shrink-0 ml-4"
          >
            Закрыть все окна
          </button>
        </div>
      )}

      {/* Global Toast Notification with PowerShell Quick View */}
      {toast && (
        <div className="fixed bottom-12 right-5 z-50 flex items-center gap-3 rounded-xl border border-indigo-500/40 bg-zinc-900/95 px-4 py-3 text-xs text-zinc-100 shadow-2xl backdrop-blur-md">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
          {toast.hasPs && (
            <button
              onClick={() => setPsDrawerOpen(true)}
              className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-1 font-mono text-[11px] text-emerald-300 hover:bg-emerald-500/25"
            >
              &lt;/&gt; PowerShell
            </button>
          )}
        </div>
      )}

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        users={users}
        computers={computers}
        groups={groups}
        onSelectUser={handleOpenUserWindow}
        onSelectComputer={(c) => {
          setSelectedComputer(c);
          setActiveTab('computers');
        }}
        onUnlockUser={handleUnlockUser}
        onNavigate={setActiveTab}
        onOpenPsDrawer={() => setPsDrawerOpen(true)}
      />

      {/* PowerShell Inspector Drawer */}
      <PowerShellDrawer
        open={psDrawerOpen}
        onClose={() => setPsDrawerOpen(false)}
        latestScript={latestPsScript}
        auditLogs={auditLogs}
      />
    </div>
  );
};
