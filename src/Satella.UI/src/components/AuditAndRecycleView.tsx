import React, { useState } from 'react';
import {
  History,
  RotateCcw,
  Trash2,
  ArchiveRestore,
  Code2,
  CheckCircle2,
} from 'lucide-react';
import type { AuditActionEntry, RecycleBinObject } from '../types';

interface Props {
  auditLogs: AuditActionEntry[];
  recycleBin: RecycleBinObject[];
  onRollback: (auditId: string) => void;
  onRestoreRecycle: (recycleId: string) => void;
}

export const AuditAndRecycleView: React.FC<Props> = ({
  auditLogs,
  recycleBin,
  onRollback,
  onRestoreRecycle,
}) => {
  const [tab, setTab] = useState<'audit' | 'recycle'>('audit');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab('audit')}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition ${
              tab === 'audit'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            Журнал изменений и Rollback ({auditLogs.length})
          </button>
          <button
            onClick={() => setTab('recycle')}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-xs font-medium transition ${
              tab === 'recycle'
                ? 'bg-indigo-600 text-white'
                : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Корзина Active Directory ({recycleBin.length})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'audit' ? (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded bg-indigo-500/15 border border-indigo-500/30 px-2 py-0.5 font-mono text-xs font-semibold text-indigo-300">
                      {log.actionType}
                    </span>
                    <span className="text-xs font-semibold text-zinc-100">
                      {log.targetName}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {log.targetDn}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-zinc-400">
                      {new Date(log.timestamp).toLocaleString()} • {log.actor}
                    </span>
                    {log.canRollback && (
                      <>
                        {log.isRolledBack ? (
                          <span className="flex items-center gap-1 rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                            Откачено
                          </span>
                        ) : (
                          <button
                            onClick={() => onRollback(log.id)}
                            className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/25"
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Откатить изменение (Rollback)
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <p className="text-xs text-zinc-200">{log.summary}</p>

                {log.powerShellScript && (
                  <div className="rounded-lg border border-zinc-800/90 bg-zinc-950 p-2.5 font-mono text-[11px] text-emerald-300/90 overflow-x-auto whitespace-pre-wrap">
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 mb-1">
                      <Code2 className="h-3 w-3" /> Эквивалент PowerShell:
                    </div>
                    {log.powerShellScript}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="py-3 px-4">Удалённый объект</th>
                  <th className="py-3 px-4">Класс</th>
                  <th className="py-3 px-4">Исходное подразделение (LastKnownParent)</th>
                  <th className="py-3 px-4">Когда и кем удалён</th>
                  <th className="py-3 px-4 text-right">Восстановление</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {recycleBin.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-zinc-500">
                      Корзина Active Directory пуста
                    </td>
                  </tr>
                ) : (
                  recycleBin.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-900/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-zinc-100">
                          {r.name}
                        </div>
                        <div className="font-mono text-[11px] text-zinc-400">
                          {r.samAccountName}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[11px] text-indigo-300">
                          {r.objectClass}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-zinc-300">
                        {r.lastKnownParentDn}
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {new Date(r.deletedAt).toLocaleString()} • {r.deletedBy}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => onRestoreRecycle(r.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
                        >
                          <ArchiveRestore className="h-3.5 w-3.5" /> Восстановить в OU
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

