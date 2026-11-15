import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Database,
  Eye,
  EyeOff,
  FileText,
  Key,
  Lock,
  Plus,
  RefreshCw,
  Send,
  Server,
  Settings,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  SafePasteEngine,
  type CustomTermRule,
  type DetectedEntity,
  type RehydrateResult,
  type SanitizeResult,
  type SensitiveCategory,
} from '@safepaste/core';
import {
  checkNanoAvailability,
  clearSavedFirebaseConfig,
  initFirebaseServices,
  isNanoReady,
  loadSavedFirebaseConfig,
  runContextualNanoScan,
  runHybridWorkspaceTask,
  saveFirebaseConfig,
  type FirebaseConnectionState,
  type NanoAvailability,
  type WorkspaceTaskType,
} from './services/firebaseAiService.ts';
import type {
  ExecutionSource,
  InferenceModeLabel,
  NetworkAuditEntry,
} from './services/networkInspector.ts';
import {
  getPrivacyStats,
  recordExecutionMetrics,
  recordScanMetrics,
  resetPrivacyStats,
  type PrivacyStats,
} from './services/privacyStorage.ts';
import { NetworkInspectorPanel } from './components/NetworkInspectorPanel.tsx';
import { PrivacyDashboardPanel } from './components/PrivacyDashboardPanel.tsx';
import { SettingsModal, type FirebaseUserConfig } from './components/SettingsModal.tsx';

interface DemoScenario {
  id: string;
  label: string;
  badge: string;
  text: string;
}

const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'corporate',
    label: 'Corporate M&A (TH/EN)',
    badge: 'Semantic + PII',
    text: 'บริษัท SCG มียอดขาย 15,400,000 บาท และมีลูกหนี้ชื่อคุณสมชาย (อีเมล somchai@scg.co.th โทร 081-234-5678) กำลังเจรจาใน Project Pegasus',
  },
  {
    id: 'devops',
    label: 'Developer Keys Leak',
    badge: 'Secrets & Creds',
    text: 'URGENT PROD FIX: Rotating leaked credentials.\nGOOGLE_API_KEY=AIzaSyD3xAmPl3K3y-1234567890abcdefghijkl\nOPENAI_API_KEY=sk-proj-99887766554433221100abcdefghijklmnopqrstuvwxyz1234\nGITHUB_TOKEN=ghp_1234567890abcdefghijklmnopqrstuvwxyz\nDB_CONFIG: host=10.240.12.88 password: "Prod#Vault99!"',
  },
  {
    id: 'banking',
    label: 'Customer KYC & Card',
    badge: 'Luhn + Thai ID',
    text: 'ลูกค้า คุณวิภาวี แจ้งเลขบัตรประชาชน 1-1002-01234-56-1 และบัตรเครดิต 4111-1111-1111-1111 เพื่อขอตรวจสอบยอดเงิน 250,000 บาท',
  },
];

const WORKSPACE_TASKS: Array<{ id: WorkspaceTaskType; label: string }> = [
  { id: 'SUMMARIZE', label: 'Summarize' },
  { id: 'REWRITE_PROFESSIONAL', label: 'Rewrite Pro' },
  { id: 'TRANSLATE_EN_TH', label: 'Translate (TH↔EN)' },
  { id: 'CODE_SECURITY_REVIEW', label: 'Risk Analysis' },
  { id: 'ACTION_ITEMS', label: 'Action Items' },
];

const CUSTOM_CATEGORIES: SensitiveCategory[] = [
  'CUSTOM',
  'PERSON',
  'ORGANIZATION',
  'PROJECT_SECRET',
  'MONEY',
  'API_KEY',
  'PASSWORD',
];

declare const chrome:
  | {
      storage?: {
        local?: {
          get: (keys: string[], cb: (items: Record<string, unknown>) => void) => void;
          remove: (keys: string[]) => void;
        };
        onChanged?: {
          addListener: (
            cb: (
              changes: Record<string, { newValue?: unknown }>,
              areaName: string
            ) => void
          ) => void;
          removeListener: (
            cb: (
              changes: Record<string, { newValue?: unknown }>,
              areaName: string
            ) => void
          ) => void;
        };
      };
      runtime?: {
        id?: string;
        sendMessage?: (msg: unknown, cb?: (resp: unknown) => void) => void;
      };
    }
  | undefined;

function renderSanitizedWithPills(text: string) {
  const parts = text.split(/(\[\[SP_[A-Z0-9_]+\]\])/g);
  return parts.map((part, idx) => {
    if (/^\[\[SP_[A-Z0-9_]+\]\]$/.test(part)) {
      return (
        <span
          key={idx}
          className="mx-0.5 inline-block rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-300"
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

function renderRehydratedWithHighlights(text: string, restoredValues: string[]) {
  if (!restoredValues.length) return text;
  const escaped = restoredValues
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map((v) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (escaped.length === 0) return text;

  const regex = new RegExp(`(${escaped.join('|')})`, 'g');
  const parts = text.split(regex);
  return parts.map((part, idx) => {
    if (restoredValues.includes(part)) {
      return (
        <span
          key={idx}
          className="rounded border border-cyan-500/40 bg-cyan-500/15 px-1 py-0.5 font-medium text-cyan-200"
        >
          {part}
        </span>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export default function App() {
  const engine = useMemo(() => new SafePasteEngine(), []);
  const isExtensionContext =
    typeof chrome !== 'undefined' && Boolean(chrome?.runtime?.id);

  // Configuration & Diagnostics
  const [firebaseConfig, setFirebaseConfig] = useState<FirebaseUserConfig>(() =>
    loadSavedFirebaseConfig()
  );
  const [firebaseState, setFirebaseState] = useState<FirebaseConnectionState>({
    connected: false,
    appCheckActive: false,
    remoteConfigSynced: false,
    activeModel: 'gemini-2.5-flash',
  });
  const [nanoStatus, setNanoStatus] = useState<NanoAvailability>('unsupported');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Stage 1 & 2 State
  const [rawText, setRawText] = useState<string>(DEMO_SCENARIOS[0].text);
  const [customTerms, setCustomTerms] = useState<CustomTermRule[]>([]);
  const [newCustomTerm, setNewCustomTerm] = useState('');
  const [newCustomCat, setNewCustomCat] = useState<SensitiveCategory>('CUSTOM');
  const [allDetectedEntities, setAllDetectedEntities] = useState<DetectedEntity[]>([]);
  const [disabledEntityIds, setDisabledEntityIds] = useState<Set<string>>(new Set());
  const [sanitizeResult, setSanitizeResult] = useState<SanitizeResult | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showRawSecretsInVault, setShowRawSecretsInVault] = useState(false);
  const [copiedSanitized, setCopiedSanitized] = useState(false);
  const [insertFeedback, setInsertFeedback] = useState<string | null>(null);

  // Stage 3 & 4 State
  const [taskType, setTaskType] = useState<WorkspaceTaskType>('SUMMARIZE');
  const [inferenceMode, setInferenceMode] =
    useState<InferenceModeLabel>('PREFER_ON_DEVICE');
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [rawAiOutput, setRawAiOutput] = useState<string | null>(null);
  const [lastExecutionSource, setLastExecutionSource] =
    useState<ExecutionSource | null>(null);
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [rehydrateResult, setRehydrateResult] = useState<RehydrateResult | null>(null);
  const [copiedFinal, setCopiedFinal] = useState(false);

  // Inspector & Dashboard State
  const [activeBottomTab, setActiveBottomTab] = useState<'inspector' | 'dashboard'>(
    'inspector'
  );
  const [auditEntries, setAuditEntries] = useState<NetworkAuditEntry[]>([]);
  const [privacyStats, setPrivacyStats] = useState<PrivacyStats>({
    totalScans: 0,
    totalEntitiesProtected: 0,
    onDeviceExecutions: 0,
    cloudExecutions: 0,
    sandboxExecutions: 0,
    categoryCounts: {},
    recentAuditLogs: [],
  });

  // Perform On-Device Scan + Tokenization
  const handleScan = useCallback(
    async (textToScan = rawText, terms = customTerms) => {
      setIsScanning(true);
      setAiError(null);
      try {
        const res = await runContextualNanoScan(textToScan, terms);
        setNanoStatus(res.nanoStatus);
        setAllDetectedEntities(res.sanitizeResult.entities);
        setDisabledEntityIds(new Set());
        setSanitizeResult(res.sanitizeResult);
        setAuditEntries((prev) => [res.auditEntry, ...prev].slice(0, 30));

        const updatedStats = await recordScanMetrics(
          res.sanitizeResult.metrics.detectedCount,
          res.sanitizeResult.metrics.categories
        );
        setPrivacyStats(updatedStats);
      } finally {
        setIsScanning(false);
      }
    },
    [rawText, customTerms]
  );

  const didInitRef = useRef(false);

  // Initialize diagnostics, Firebase, IndexedDB stats, and initial scan on mount
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    void checkNanoAvailability().then(setNanoStatus);
    void initFirebaseServices(firebaseConfig).then(setFirebaseState);
    void getPrivacyStats().then(setPrivacyStats);
    void handleScan(DEMO_SCENARIOS[0].text, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chrome Extension Side Panel Bridge
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome?.storage?.local) return;

    chrome.storage.local.get(['pendingSafePasteInput'], (items) => {
      const pending = items?.pendingSafePasteInput;
      if (typeof pending === 'string' && pending.trim()) {
        setRawText(pending);
        void handleScan(pending, customTerms);
        chrome.storage?.local?.remove(['pendingSafePasteInput']);
      }
    });

    const listener = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string
    ) => {
      if (areaName === 'local' && changes.pendingSafePasteInput?.newValue) {
        const nextText = String(changes.pendingSafePasteInput.newValue);
        if (nextText.trim()) {
          setRawText(nextText);
          void handleScan(nextText, customTerms);
          chrome.storage?.local?.remove(['pendingSafePasteInput']);
        }
      }
    };

    chrome.storage.onChanged?.addListener(listener);
    return () => {
      chrome.storage?.onChanged?.removeListener(listener);
    };
  }, [customTerms, handleScan]);

  // Toggle individual entity inclusion and re-tokenize immediately
  const handleToggleEntity = (entityId: string) => {
    const nextDisabled = new Set(disabledEntityIds);
    if (nextDisabled.has(entityId)) {
      nextDisabled.delete(entityId);
    } else {
      nextDisabled.add(entityId);
    }
    setDisabledEntityIds(nextDisabled);

    const activeEntities = allDetectedEntities.filter(
      (e) => !nextDisabled.has(e.id)
    );
    const updatedSanitize = engine.tokenizeEntities(rawText, activeEntities);
    setSanitizeResult(updatedSanitize);
  };

  const handleAddCustomTerm = () => {
    const trimmed = newCustomTerm.trim();
    if (!trimmed) return;
    const nextTerms = [...customTerms, { value: trimmed, category: newCustomCat }];
    setCustomTerms(nextTerms);
    setNewCustomTerm('');
    void handleScan(rawText, nextTerms);
  };

  const handleLoadScenario = (scenario: DemoScenario) => {
    setRawText(scenario.text);
    setRawAiOutput(null);
    setRehydrateResult(null);
    setAiError(null);
    void handleScan(scenario.text, customTerms);
  };

  const handleRunHybridTask = async () => {
    if (!sanitizeResult) return;
    setIsRunningAi(true);
    setAiError(null);

    try {
      const result = await runHybridWorkspaceTask(
        sanitizeResult.sanitizedText,
        taskType,
        inferenceMode,
        sanitizeResult.tokenMap
      );

      setRawAiOutput(result.outputText);
      setLastExecutionSource(result.executionSource);
      setLastLatencyMs(result.latencyMs);
      setAuditEntries((prev) => [result.auditEntry, ...prev].slice(0, 30));

      // Stage 4: Local Safe Rehydration
      const rehydrated = engine.rehydrate(
        result.outputText,
        sanitizeResult.tokenMap
      );
      setRehydrateResult(rehydrated);

      const updatedStats = await recordExecutionMetrics({
        taskType,
        executionSource: result.executionSource,
        tokensCount: Object.keys(sanitizeResult.tokenMap).length,
        latencyMs: result.latencyMs,
        zeroLeakageVerified: result.auditEntry.zeroLeakageVerified,
      });
      setPrivacyStats(updatedStats);
    } catch (err: unknown) {
      const errorObj = err as Error & { auditEntry?: NetworkAuditEntry };
      if (errorObj.auditEntry) {
        setAuditEntries((prev) => [errorObj.auditEntry!, ...prev].slice(0, 30));
      }
      setAiError(errorObj.message || 'Inference failed.');
    } finally {
      setIsRunningAi(false);
    }
  };

  const handleCopySanitized = async () => {
    if (!sanitizeResult) return;
    await navigator.clipboard.writeText(sanitizeResult.sanitizedText);
    setCopiedSanitized(true);
    setTimeout(() => setCopiedSanitized(false), 1800);
  };

  const handleCopyFinal = async () => {
    if (!rehydrateResult) return;
    await navigator.clipboard.writeText(rehydrateResult.rehydratedText);
    setCopiedFinal(true);
    setTimeout(() => setCopiedFinal(false), 1800);
  };

  const handleInsertIntoActiveTab = () => {
    if (!sanitizeResult || !chrome?.runtime?.sendMessage) return;
    chrome.runtime.sendMessage(
      {
        type: 'INSERT_SAFEPASTE_INTO_ACTIVE_TAB',
        text: sanitizeResult.sanitizedText,
      },
      (resp: unknown) => {
        const res = resp as { ok?: boolean; error?: string } | undefined;
        if (res?.ok) {
          setInsertFeedback('Inserted into active AI chat!');
        } else {
          setInsertFeedback(res?.error || 'Could not detect active chat box');
        }
        setTimeout(() => setInsertFeedback(null), 2500);
      }
    );
  };

  const handleSaveConfig = async (nextConfig: FirebaseUserConfig) => {
    setFirebaseConfig(nextConfig);
    saveFirebaseConfig(nextConfig);
    const state = await initFirebaseServices(nextConfig);
    setFirebaseState(state);
  };

  const handleClearConfig = async () => {
    clearSavedFirebaseConfig();
    const emptyCfg = loadSavedFirebaseConfig();
    setFirebaseConfig(emptyCfg);
    const state = await initFirebaseServices(emptyCfg);
    setFirebaseState(state);
  };

  const handleResetStats = async () => {
    const empty = await resetPrivacyStats();
    setPrivacyStats(empty);
  };

  const restoredRawValues = useMemo(() => {
    if (!sanitizeResult) return [];
    return Object.values(sanitizeResult.tokenMap).map((m) => m.rawValue);
  }, [sanitizeResult]);

  const tokenEntries = sanitizeResult
    ? Object.values(sanitizeResult.tokenMap)
    : [];

  return (
    <div className="min-h-screen min-w-[360px] bg-slate-950 text-slate-100">
      {/* Top Navigation & Live Telemetry Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 shadow-inner">
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-white">
                  SafePaste AI
                </h1>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                  #BuildHybridAI 2026
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Your Private Gateway to AI · Zero Raw Leakage
              </p>
            </div>
          </div>

          {/* Live Status Telemetry Pills */}
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <div
              title="Chrome Built-in Prompt API (Gemini Nano)"
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
                isNanoReady(nanoStatus)
                  ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                  : 'border-slate-700 bg-slate-900 text-slate-300'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>
                Gemini Nano:{' '}
                {isNanoReady(nanoStatus)
                  ? 'Ready (On-Device)'
                  : nanoStatus === 'after-download' ||
                      nanoStatus === 'downloadable' ||
                      nanoStatus === 'downloading'
                    ? 'Download Needed'
                    : 'Offline Heuristic'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium transition ${
                firebaseState.connected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              <Server className="h-3.5 w-3.5" />
              <span>
                {firebaseState.connected
                  ? `Firebase Connected${firebaseState.appCheckActive ? ' (App Check ✓)' : ''}`
                  : 'Sandbox Mode (Configure Firebase)'}
              </span>
            </button>

            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-300 sm:inline-flex">
              <Lock className="h-3 w-3" />
              <span>ONLY_ON_DEVICE Scan</span>
            </div>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              aria-label="Open Settings"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-5">
        {/* Judge-Ready 1-Click Demo Scenarios */}
        <section className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-300">
            <Sparkles className="h-4 w-4 text-emerald-400" />
            <span>1-Click Test Scenarios:</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEMO_SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => handleLoadScenario(sc)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/80 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-200 transition hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-white"
              >
                <span className="font-medium">{sc.label}</span>
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-emerald-300">
                  {sc.badge}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Main 2-Column 4-Stage Pipeline */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* LEFT COLUMN: Stage 1 & Stage 2 (Local Privacy Scan + Token Vault) */}
          <section className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/15 font-mono text-xs font-bold text-cyan-300">
                    1
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Raw Input & On-Device Privacy Scan
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Never leaves your browser · Deterministic + Gemini Nano
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleScan(rawText, customTerms)}
                  disabled={isScanning}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`}
                  />
                  {isScanning ? 'Scanning...' : 'Scan & Protect'}
                </button>
              </div>

              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                rows={5}
                placeholder="Paste confidential text, API keys, emails, or Thai financial records here..."
                className="w-full rounded-xl border border-slate-700/80 bg-slate-950 p-3 font-sans text-xs leading-relaxed text-slate-100 placeholder-slate-600 focus:border-cyan-500 focus:outline-none"
              />

              {/* Add Custom Mask Term */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={newCustomTerm}
                  onChange={(e) => setNewCustomTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTerm()}
                  placeholder="Add custom word/secret to mask..."
                  className="min-w-[160px] flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
                <select
                  value={newCustomCat}
                  onChange={(e) =>
                    setNewCustomCat(e.target.value as SensitiveCategory)
                  }
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 font-mono text-[11px] text-slate-300 focus:border-cyan-500 focus:outline-none"
                >
                  {CUSTOM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCustomTerm}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:border-cyan-500/40 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Mask Term
                </button>
              </div>

              {/* Detected Entities Toggle List */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    Detected Sensitive Entities ({allDetectedEntities.length})
                  </span>
                  {sanitizeResult && (
                    <span className="font-mono text-[11px] text-slate-400">
                      Scanned in {sanitizeResult.metrics.scanTimeMs}ms
                    </span>
                  )}
                </div>

                {allDetectedEntities.length === 0 ? (
                  <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-center text-xs text-slate-500">
                    No sensitive entities detected in current text.
                  </div>
                ) : (
                  <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                    {allDetectedEntities.map((entity) => {
                      const isEnabled = !disabledEntityIds.has(entity.id);
                      return (
                        <label
                          key={entity.id}
                          className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition ${
                            isEnabled
                              ? 'border-emerald-500/30 bg-emerald-500/5'
                              : 'border-slate-800 bg-slate-950/50 opacity-60'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => handleToggleEntity(entity.id)}
                              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                            />
                            <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                              {entity.category}
                            </span>
                            <span className="truncate font-mono text-[11px] text-slate-200">
                              {entity.rawValue}
                            </span>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                                entity.method === 'DETERMINISTIC_REGEX'
                                  ? 'bg-sky-500/15 text-sky-300'
                                  : entity.method === 'SEMANTIC_NANO'
                                    ? 'bg-violet-500/15 text-violet-300'
                                    : 'bg-amber-500/15 text-amber-300'
                              }`}
                            >
                              {entity.method === 'DETERMINISTIC_REGEX'
                                ? 'REGEX'
                                : entity.method === 'SEMANTIC_NANO'
                                  ? 'NANO'
                                  : 'CUSTOM'}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              {Math.round(entity.confidence * 100)}%
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Stage 2: Sanitized Prompt Preview & Ephemeral Local Vault */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 font-mono text-xs font-bold text-emerald-300">
                    2
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Sanitized Gateway Output
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Safe for Cloud AI · Invariant tokens [[SP_*]]
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isExtensionContext && (
                    <button
                      type="button"
                      onClick={handleInsertIntoActiveTab}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                      Insert to Chat
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleCopySanitized}
                    disabled={!sanitizeResult}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:border-emerald-500/40 hover:text-white"
                  >
                    {copiedSanitized ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy Safe Prompt
                      </>
                    )}
                  </button>
                </div>
              </div>

              {insertFeedback && (
                <div className="mb-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
                  {insertFeedback}
                </div>
              )}

              <div className="min-h-[88px] whitespace-pre-wrap break-words rounded-xl border border-emerald-500/25 bg-slate-950 p-3 text-xs leading-relaxed text-slate-200">
                {sanitizeResult
                  ? renderSanitizedWithPills(sanitizeResult.sanitizedText)
                  : 'Run a scan to preview sanitized text...'}
              </div>

              {/* Ephemeral Local Token Vault Table */}
              <div className="mt-4">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                    <Key className="h-3.5 w-3.5 text-amber-400" />
                    <span>Local Ephemeral Token Vault ({tokenEntries.length})</span>
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-normal text-slate-400">
                      100% In-Browser Memory
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowRawSecretsInVault((v) => !v)}
                    className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
                  >
                    {showRawSecretsInVault ? (
                      <>
                        <EyeOff className="h-3 w-3" /> Hide Secrets
                      </>
                    ) : (
                      <>
                        <Eye className="h-3 w-3" /> Reveal Secrets
                      </>
                    )}
                  </button>
                </div>

                {tokenEntries.length > 0 && (
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/70">
                    <table className="w-full text-left text-[11px]">
                      <thead className="border-b border-slate-800 bg-slate-900/80 text-slate-400">
                        <tr>
                          <th className="px-3 py-1.5 font-mono">Token</th>
                          <th className="px-3 py-1.5">Local Secret Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {tokenEntries.map((mapping) => (
                          <tr key={mapping.token}>
                            <td className="px-3 py-1.5 font-mono font-semibold text-emerald-300">
                              {mapping.token}
                            </td>
                            <td className="px-3 py-1.5 font-mono text-slate-300">
                              {showRawSecretsInVault
                                ? mapping.rawValue
                                : '••••••••••••'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Stage 3 & Stage 4 (Hybrid Inference + Safe Rehydration) */}
          <section className="space-y-4 lg:col-span-6">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/15 font-mono text-xs font-bold text-violet-300">
                    3
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Firebase AI Logic Hybrid Workspace
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Processes only [[SP_*]] sanitized prompt · Zero raw leakage
                    </p>
                  </div>
                </div>
              </div>

              {/* Task Selector */}
              <div className="mb-3">
                <div className="mb-1.5 text-[11px] font-medium text-slate-400">
                  1. Choose AI Workspace Task:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {WORKSPACE_TASKS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTaskType(t.id)}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                        taskType === t.id
                          ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                          : 'border-slate-700 bg-slate-950/70 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Inference Mode Selector & Execute CTA */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <label className="min-w-[200px] flex-1 space-y-1">
                  <span className="block text-[11px] font-medium text-slate-400">
                    2. Firebase Hybrid Inference Mode:
                  </span>
                  <select
                    value={inferenceMode}
                    onChange={(e) =>
                      setInferenceMode(e.target.value as InferenceModeLabel)
                    }
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200 focus:border-violet-500 focus:outline-none"
                  >
                    <option value="PREFER_ON_DEVICE">
                      PREFER_ON_DEVICE (Hybrid Auto-Route)
                    </option>
                    <option value="ONLY_ON_DEVICE">
                      ONLY_ON_DEVICE (Strict Local)
                    </option>
                    <option value="ONLY_IN_CLOUD">
                      ONLY_IN_CLOUD ({firebaseState.activeModel})
                    </option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleRunHybridTask}
                  disabled={isRunningAi || !sanitizeResult}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 shadow-md transition hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isRunningAi ? 'Processing Hybrid AI...' : 'Run Hybrid AI'}
                </button>
              </div>

              {aiError && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  <span>{aiError}</span>
                </div>
              )}
            </div>

            {/* Stage 4: Raw AI Output vs Rehydrated Final Result */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 font-mono text-xs font-bold text-emerald-300">
                    4
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Safe Response Rehydration
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Compare AI response vs locally restored output
                    </p>
                  </div>
                </div>

                {lastExecutionSource && (
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                        lastExecutionSource === 'FIREBASE_CLOUD_GEMINI'
                          ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                          : 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300'
                      }`}
                    >
                      {lastExecutionSource}
                    </span>
                    {lastLatencyMs !== null && (
                      <span className="font-mono text-[11px] text-slate-400">
                        {lastLatencyMs}ms
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Dual View Output */}
              <div className="space-y-3">
                <div>
                  <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-slate-400">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Raw Response from AI (Cloud never saw real secrets)
                    </span>
                  </div>
                  <div className="min-h-[90px] whitespace-pre-wrap break-words rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs leading-relaxed text-slate-300">
                    {rawAiOutput
                      ? renderSanitizedWithPills(rawAiOutput)
                      : 'Click "Run Hybrid AI" to execute on sanitized text...'}
                  </div>
                </div>

                <div>
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-[11px] font-medium text-slate-300">
                    <span className="flex items-center gap-1 text-emerald-300">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Rehydrated Final Result (Restored On-Device)
                    </span>
                    {rehydrateResult && (
                      <button
                        type="button"
                        onClick={handleCopyFinal}
                        className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] text-slate-200 hover:text-white"
                      >
                        {copiedFinal ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy Result
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <div className="min-h-[110px] whitespace-pre-wrap break-words rounded-xl border border-cyan-500/30 bg-slate-950 p-3 text-xs leading-relaxed text-slate-100">
                    {rehydrateResult
                      ? renderRehydratedWithHighlights(
                          rehydrateResult.rehydratedText,
                          restoredRawValues
                        )
                      : 'Rehydrated result will appear here with original entities safely restored...'}
                  </div>
                </div>

                {/* Token Integrity Verification Badges */}
                {rehydrateResult && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-medium text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Restored: {rehydrateResult.restoredTokens.length} token(s)
                    </span>

                    {rehydrateResult.alteredTokens.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 font-medium text-cyan-300">
                        <Shield className="h-3.5 w-3.5" />
                        Fuzzy Recovered: {rehydrateResult.alteredTokens.length}
                      </span>
                    )}

                    {rehydrateResult.missingTokens.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 font-medium text-amber-300">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Omitted by AI: {rehydrateResult.missingTokens.join(', ')}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Bottom Tabbed Panel: Zero-Leakage Network Inspector & Privacy Dashboard */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-lg">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveBottomTab('inspector')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  activeBottomTab === 'inspector'
                    ? 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Terminal className="h-4 w-4" />
                Zero-Leakage Network Inspector
                <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                  {auditEntries.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveBottomTab('dashboard')}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
                  activeBottomTab === 'dashboard'
                    ? 'bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <Database className="h-4 w-4" />
                Privacy Dashboard
              </button>
            </div>

            <div className="text-[11px] text-slate-400">
              Audit Log · Built with Firebase AI Logic, App Check & Remote Config
            </div>
          </div>

          {activeBottomTab === 'inspector' ? (
            <NetworkInspectorPanel entries={auditEntries} />
          ) : (
            <PrivacyDashboardPanel
              stats={privacyStats}
              onReset={handleResetStats}
            />
          )}
        </section>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={firebaseConfig}
        nanoStatus={nanoStatus}
        onSave={handleSaveConfig}
        onClear={handleClearConfig}
      />
    </div>
  );
}
