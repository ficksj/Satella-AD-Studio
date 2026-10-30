import React, { useState } from 'react';
import { Terminal, Copy, Check, X, Download, Sparkles } from 'lucide-react';
import type { AuditActionEntry } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  latestScript: string;
  auditLogs: AuditActionEntry[];
}

export const PowerShellDrawer: React.FC<Props> = ({
  open,
  onClose,
  latestScript,
  auditLogs,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedScript, setSelectedScript] = useState<string>('');

  if (!open) return null;

  const activeCode =
    selectedScript ||
    latestScript ||
    auditLogs[0]?.powerShellScript ||
    '# Выполните любое действие в интерфейсе Satella AD Studio,\n# и здесь автоматически появится готовый PowerShell-скрипт (ActiveDirectory / WinRM).';

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const blob = new Blob([activeCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `satella-ad-action-${Date.now()}.ps1`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-2xl flex-col border-l border-zinc-800 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Terminal className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">
                Генератор и инспектор PowerShell (ActiveDirectory Module)
              </h3>
              <p className="text-xs text-zinc-400">
                Каждое действие в UI транслируется в чистый PowerShell-код для автоматизации
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="rounded-xl border border-zinc-800 bg-[#070709] overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/60 px-4 py-2">
              <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" /> PowerShell 7 / Windows PowerShell 5.1
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" /> Скопировано
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Копировать код
                    </>
                  )}
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-indigo-500/25"
                >
                  <Download className="h-3.5 w-3.5" /> Скачать .ps1
                </button>
              </div>
            </div>
            <pre className="p-4 font-mono text-xs leading-relaxed text-emerald-300 overflow-x-auto whitespace-pre-wrap">
              {activeCode}
            </pre>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
              История сгенерированных скриптов в этой сессии
            </h4>
            <div className="space-y-2">
              {auditLogs.slice(0, 12).map((log) => (
                <button
                  key={log.id}
                  onClick={() => setSelectedScript(log.powerShellScript)}
                  className="w-full rounded-lg border border-zinc-800/90 bg-zinc-900/40 p-3 text-left hover:border-zinc-700 hover:bg-zinc-900 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-200">
                      {log.summary}
                    </span>
                    <span className="font-mono text-[11px] text-zinc-500">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-emerald-400/80 truncate">
                    {log.powerShellScript.split('\n').find((l) => !l.startsWith('#')) ||
                      log.powerShellScript}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

