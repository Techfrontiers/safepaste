import {
  BarChart3,
  Cpu,
  Database,
  Server,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { PrivacyStats } from '../services/privacyStorage.ts';

interface PrivacyDashboardPanelProps {
  stats: PrivacyStats;
  onReset: () => void;
}

export function PrivacyDashboardPanel({
  stats,
  onReset,
}: PrivacyDashboardPanelProps) {
  const totalExecutions =
    stats.onDeviceExecutions + stats.cloudExecutions + stats.sandboxExecutions;
  const onDeviceRatio =
    totalExecutions > 0
      ? Math.round(
          ((stats.onDeviceExecutions + stats.sandboxExecutions) / totalExecutions) *
            100
        )
      : 100;

  const sortedCategories = Object.entries(stats.categoryCounts).sort(
    (a, b) => b[1] - a[1]
  );
  const maxCatCount = sortedCategories[0]?.[1] || 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Database className="h-4 w-4 text-emerald-400" />
          <span>
            IndexedDB Local Vault (<code className="text-emerald-300">safepaste_privacy_db</code>) — Raw user text is{' '}
            <strong className="text-white">never</strong> stored.
          </span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Reset Metrics
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Secrets Protected</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-white">
            {stats.totalEntitiesProtected}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Across {stats.totalScans} local scan(s)
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>On-Device Runs</span>
            <Cpu className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-cyan-300">
            {stats.onDeviceExecutions}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Gemini Nano / Hybrid Local
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Cloud Hybrid Runs</span>
            <Server className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-300">
            {stats.cloudExecutions}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            Sanitized payload only
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Local Containment</span>
            <BarChart3 className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-300">
            {onDeviceRatio}%
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {stats.sandboxExecutions} sandbox simulation(s)
          </div>
        </div>
      </div>

      {/* Category Distribution & Recent Audit Logs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Protected Entity Categories
          </h3>
          {sortedCategories.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              No sensitive entities scanned yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {sortedCategories.map(([category, count]) => (
                <div key={category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-300">{category}</span>
                    <span className="font-mono font-semibold text-emerald-300">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all"
                      style={{ width: `${Math.max(8, (count / maxCatCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Zero-Content Privacy Audit History
          </h3>
          {stats.recentAuditLogs.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              Run a Hybrid AI task to log metadata entries.
            </p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {stats.recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-slate-200">
                      {log.taskType}
                    </div>
                    <div className="font-mono text-[10px] text-slate-400">
                      {log.executionSource} · {log.tokensCount} token(s) masked
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[11px] text-emerald-400">
                      {log.zeroLeakageVerified ? '0% LEAK' : 'BLOCKED'}
                    </div>
                    <div className="font-mono text-[10px] text-slate-500">
                      {log.latencyMs}ms
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
