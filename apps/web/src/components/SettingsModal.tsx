import { useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  KeyRound,
  Shield,
  Sliders,
  X,
} from 'lucide-react';

export interface FirebaseUserConfig {
  apiKey: string;
  projectId: string;
  appId: string;
  appCheckDebugToken: string;
  useDebugAppCheck: boolean;
  recaptchaSiteKey: string;
  modelOverride: string;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: FirebaseUserConfig;
  nanoStatus: string;
  onSave: (nextConfig: FirebaseUserConfig) => void;
  onClear: () => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  config,
  nanoStatus,
  onSave,
  onClear,
}: SettingsModalProps) {
  const [draft, setDraft] = useState<FirebaseUserConfig>(config);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...draft,
      modelOverride: draft.modelOverride.trim() || 'gemini-2.5-flash',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-5 w-5 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">
              Firebase AI Logic & Hybrid Engine Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 text-xs">
          {/* Chrome Gemini Nano Diagnostic */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Cpu className="h-4 w-4 text-cyan-400" />
                <span>On-Device Gemini Nano (Chrome Prompt API)</span>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                  nanoStatus === 'readily' || nanoStatus === 'available'
                    ? 'bg-emerald-500/15 text-emerald-300'
                    : 'bg-amber-500/15 text-amber-300'
                }`}
              >
                status: {nanoStatus}
              </span>
            </div>
            <p className="mt-2 leading-relaxed text-slate-400">
              To run hardware-accelerated on-device inference in Chrome Desktop, enable{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-cyan-300">
                chrome://flags/#prompt-api-for-gemini-nano
              </code>{' '}
              and{' '}
              <code className="rounded bg-slate-800 px-1 py-0.5 text-cyan-300">
                chrome://flags/#optimization-guide-on-device-model
              </code>{' '}
              (BypassPerfRequirement). When unavailable, SafePaste automatically falls back to its local offline heuristic engine without leaking raw text.
            </p>
          </div>

          {/* Firebase Configuration */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-semibold text-slate-200">
              <KeyRound className="h-4 w-4 text-emerald-400" />
              <span>Firebase Project Credentials (Stored Locally in Browser)</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-slate-400">Firebase API Key</span>
                <input
                  type="password"
                  value={draft.apiKey}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  placeholder="AIzaSy..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-slate-400">Firebase Project ID</span>
                <input
                  type="text"
                  value={draft.projectId}
                  onChange={(e) => setDraft({ ...draft, projectId: e.target.value })}
                  placeholder="safepaste-hybrid-ai"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </label>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-slate-400">Firebase App ID</span>
                <input
                  type="text"
                  value={draft.appId}
                  onChange={(e) => setDraft({ ...draft, appId: e.target.value })}
                  placeholder="1:123456789:web:abcdef"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-slate-400">
                  Cloud Model (Remote Config Default)
                </span>
                <input
                  type="text"
                  value={draft.modelOverride}
                  onChange={(e) =>
                    setDraft({ ...draft, modelOverride: e.target.value })
                  }
                  placeholder="gemini-2.5-flash"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-emerald-300 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </label>
            </div>
          </div>

          {/* App Check Section */}
          <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-slate-200">
                <Shield className="h-4 w-4 text-violet-400" />
                <span>Firebase App Check Attestation</span>
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={draft.useDebugAppCheck}
                  onChange={(e) =>
                    setDraft({ ...draft, useDebugAppCheck: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
                <span>Debug Provider (Local / Extension)</span>
              </label>
            </div>

            {draft.useDebugAppCheck ? (
              <label className="block space-y-1">
                <span className="text-slate-400">
                  App Check Debug Token (optional — leave blank to auto-generate)
                </span>
                <input
                  type="text"
                  value={draft.appCheckDebugToken}
                  onChange={(e) =>
                    setDraft({ ...draft, appCheckDebugToken: e.target.value })
                  }
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                />
              </label>
            ) : (
              <label className="block space-y-1">
                <span className="text-slate-400">
                  reCAPTCHA Enterprise Site Key
                </span>
                <input
                  type="text"
                  value={draft.recaptchaSiteKey}
                  onChange={(e) =>
                    setDraft({ ...draft, recaptchaSiteKey: e.target.value })
                  }
                  placeholder="6Lc..."
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-xs text-white placeholder-slate-600 focus:border-violet-500 focus:outline-none"
                />
              </label>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                onClear();
                onClose();
              }}
              className="rounded-lg border border-slate-700 px-3 py-2 font-medium text-slate-300 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-300"
            >
              Use Sandbox Mode (Clear Keys)
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-slate-950 transition hover:bg-emerald-400"
              >
                <CheckCircle2 className="h-4 w-4" />
                Save & Initialize
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
