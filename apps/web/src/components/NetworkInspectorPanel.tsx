import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Cpu,
  Lock,
  Server,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import type { NetworkAuditEntry } from '../services/networkInspector.ts';

interface NetworkInspectorPanelProps {
  entries: NetworkAuditEntry[];
}

export function NetworkInspectorPanel({ entries }: NetworkInspectorPanelProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center">
        <Terminal className="mx-auto mb-3 h-10 w-10 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-200">
          Zero-Leakage Network Tap Ready
        </h3>
        <p className="mx-auto mt-1 max-w-md text-xs text-slate-400">
          Run an On-Device Privacy Scan or Hybrid AI task. Every outbound payload and local execution trace will be audited and logged here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-300">
        <div className="flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Real-Time Egress Auditor Active — Raw PII checked before every AI call</span>
        </div>
        <span className="font-mono text-emerald-400">{entries.length} trace(s)</span>
      </div>

      {entries.map((entry) => {
        const isLocal =
          entry.executionSource === 'GEMINI_NANO_ON_DEVICE' ||
          entry.executionSource === 'FIREBASE_HYBRID_ON_DEVICE' ||
          entry.executionSource === 'LOCAL_SANDBOX_SIMULATION' ||
          entry.executionSource === 'LOCAL_DEMO_ENGINE';

        return (
          <div
            key={entry.id}
            className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-950/50 px-4 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold ${
                    entry.stage === 'ON_DEVICE_SCAN'
                      ? 'bg-cyan-500/15 text-cyan-300'
                      : 'bg-violet-500/15 text-violet-300'
                  }`}
                >
                  {entry.stage}
                </span>

                <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] text-slate-300">
                  {entry.mode}
                </span>

                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${
                    isLocal
                      ? 'bg-emerald-500/15 text-emerald-300'
                      : 'bg-amber-500/15 text-amber-300'
                  }`}
                >
                  {isLocal ? (
                    <Cpu className="h-3 w-3" />
                  ) : (
                    <Server className="h-3 w-3" />
                  )}
                  {entry.executionSource}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[11px] text-slate-400">
                <span className="inline-flex items-center gap-1 font-mono">
                  <Clock className="h-3 w-3" />
                  {entry.latencyMs}ms
                </span>
                <span className="font-mono">
                  {new Date(entry.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="space-y-2.5 p-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                  <Activity className="h-3.5 w-3.5 text-slate-500" />
                  <span>Target:</span>
                  <span className="text-slate-200">{entry.endpoint}</span>
                  {entry.modelName && (
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300">
                      {entry.modelName}
                    </span>
                  )}
                </div>

                {entry.zeroLeakageVerified ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    Zero Raw Secrets Leaked: VERIFIED ({entry.rawSecretsChecked} checked)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-rose-300">
                    <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                    BLOCKED: Unmasked Secret Detected ({entry.leakedSecretsFound.join(', ')})
                  </span>
                )}
              </div>

              <div>
                <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <Lock className="h-3 w-3 text-slate-500" />
                  <span>Exact Outbound Payload Inspected:</span>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                  {entry.outboundPayload}
                </pre>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
