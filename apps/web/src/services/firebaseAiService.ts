import { deleteApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import {
  getAI,
  getGenerativeModel,
  GoogleAIBackend,
  InferenceMode,
  InferenceSource,
  type AI,
  type HybridParams,
} from 'firebase/ai';
import {
  SafePasteEngine,
  type CustomTermRule,
  type SanitizeResult,
  type TokenMapping,
} from '@safepaste/core';
import type { FirebaseUserConfig } from '../components/SettingsModal.tsx';
import {
  createAuditId,
  verifyZeroLeakage,
  type ExecutionSource,
  type InferenceModeLabel,
  type NetworkAuditEntry,
} from './networkInspector.ts';

export type NanoAvailability =
  | 'readily'
  | 'available'
  | 'after-download'
  | 'downloadable'
  | 'downloading'
  | 'no'
  | 'unavailable'
  | 'unsupported';

export function isNanoReady(status: NanoAvailability): boolean {
  return status === 'readily' || status === 'available';
}

export type WorkspaceTaskType =
  | 'SUMMARIZE'
  | 'REWRITE_PROFESSIONAL'
  | 'TRANSLATE_EN_TH'
  | 'CODE_SECURITY_REVIEW'
  | 'ACTION_ITEMS';

export interface FirebaseConnectionState {
  connected: boolean;
  appCheckActive: boolean;
  remoteConfigSynced: boolean;
  activeModel: string;
  error?: string;
}

export interface HybridTaskResult {
  outputText: string;
  executionSource: ExecutionSource;
  latencyMs: number;
  auditEntry: NetworkAuditEntry;
}

export interface NanoScanWithAuditResult {
  sanitizeResult: SanitizeResult;
  nanoStatus: NanoAvailability;
  executionSource: ExecutionSource;
  auditEntry: NetworkAuditEntry;
}

let cachedApp: FirebaseApp | null = null;
let cachedAi: AI | null = null;
let currentModelName = 'gemini-3.8-flash';
let currentConnectionState: FirebaseConnectionState = {
  connected: false,
  appCheckActive: false,
  remoteConfigSynced: false,
  activeModel: 'gemini-3.8-flash',
};

const CONFIG_STORAGE_KEY = 'safepaste_firebase_config_v1';

export function getDefaultFirebaseConfig(): FirebaseUserConfig {
  const env =
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    apiKey: env.VITE_FIREBASE_API_KEY?.trim() || '',
    projectId: env.VITE_FIREBASE_PROJECT_ID?.trim() || '',
    appId: env.VITE_FIREBASE_APP_ID?.trim() || '',
    appCheckDebugToken: env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim() || '',
    useDebugAppCheck: env.VITE_FIREBASE_USE_DEBUG_APPCHECK === 'true',
    recaptchaSiteKey: env.VITE_FIREBASE_RECAPTCHA_SITE_KEY?.trim() || '',
    modelOverride: env.VITE_FIREBASE_MODEL_OVERRIDE?.trim() || 'gemini-3.8-flash',
  };
}

export function loadSavedFirebaseConfig(): FirebaseUserConfig {
  const defaults = getDefaultFirebaseConfig();
  try {
    const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<FirebaseUserConfig>;
    return {
      ...defaults,
      ...parsed,
      apiKey: parsed.apiKey?.trim() ? parsed.apiKey : defaults.apiKey,
      projectId: parsed.projectId?.trim() ? parsed.projectId : defaults.projectId,
      appId: parsed.appId?.trim() ? parsed.appId : defaults.appId,
      recaptchaSiteKey: parsed.recaptchaSiteKey?.trim()
        ? parsed.recaptchaSiteKey
        : defaults.recaptchaSiteKey,
      appCheckDebugToken: parsed.appCheckDebugToken?.trim()
        ? parsed.appCheckDebugToken
        : defaults.appCheckDebugToken,
      useDebugAppCheck: parsed.appCheckDebugToken?.trim()
        ? Boolean(parsed.useDebugAppCheck)
        : defaults.useDebugAppCheck,
      modelOverride: parsed.modelOverride?.trim()
        ? parsed.modelOverride
        : defaults.modelOverride,
    };
  } catch {
    return defaults;
  }
}

export function saveFirebaseConfig(config: FirebaseUserConfig): void {
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearSavedFirebaseConfig(): void {
  try {
    localStorage.removeItem(CONFIG_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Queries the Chrome Built-in AI Prompt API (Gemini Nano) availability directly.
 */
export async function checkNanoAvailability(): Promise<NanoAvailability> {
  if (typeof window === 'undefined') return 'unsupported';
  try {
    const win = window as unknown as {
      LanguageModel?: {
        availability: (opts?: Record<string, unknown>) => Promise<NanoAvailability>;
      };
      ai?: {
        languageModel?: {
          availability: (opts?: Record<string, unknown>) => Promise<NanoAvailability>;
        };
      };
    };
    const lm = win.LanguageModel || win.ai?.languageModel;
    if (!lm || typeof lm.availability !== 'function') {
      return 'unsupported';
    }
    try {
      return await lm.availability({
        expectedOutputs: [{ type: 'text', languages: ['en'] }],
      });
    } catch {
      return await lm.availability();
    }
  } catch {
    return 'unsupported';
  }
}

/**
 * Initializes Firebase App, App Check, Remote Config, and Firebase AI Logic SDK.
 */
export async function initFirebaseServices(
  config: FirebaseUserConfig
): Promise<FirebaseConnectionState> {
  const targetModel = config.modelOverride?.trim() || 'gemini-3.8-flash';
  currentModelName = targetModel;

  if (!config.apiKey.trim() || !config.projectId.trim() || !config.appId.trim()) {
    cachedAi = null;
    currentConnectionState = {
      connected: false,
      appCheckActive: false,
      remoteConfigSynced: false,
      activeModel: targetModel,
    };
    return currentConnectionState;
  }

  try {
    // Reset existing instance cleanly if credentials changed
    const existingApps = getApps();
    for (const app of existingApps) {
      await deleteApp(app);
    }

    const hasRecaptcha = Boolean(config.recaptchaSiteKey.trim());
    const hasDebugToken = Boolean(
      config.useDebugAppCheck && config.appCheckDebugToken.trim()
    );

    if (config.useDebugAppCheck) {
      (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
        config.appCheckDebugToken.trim() || true;
    }

    cachedApp = initializeApp({
      apiKey: config.apiKey.trim(),
      projectId: config.projectId.trim(),
      appId: config.appId.trim(),
    });

    let appCheckActive = false;
    if (hasRecaptcha || hasDebugToken) {
      try {
        if (config.useDebugAppCheck) {
          (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
            config.appCheckDebugToken.trim() || true;
        }

        const siteKey =
          config.recaptchaSiteKey.trim() || '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';

        initializeAppCheck(cachedApp, {
          provider: new ReCaptchaEnterpriseProvider(siteKey),
          isTokenAutoRefreshEnabled: true,
        });
        appCheckActive = true;
      } catch {
        appCheckActive = false;
      }
    }

    let remoteConfigSynced = false;
    try {
      const rc = getRemoteConfig(cachedApp);
      rc.settings.minimumFetchIntervalMillis = 60_000;
      rc.defaultConfig = {
        safepaste_gemini_model: targetModel,
      };
      await fetchAndActivate(rc);
      const remoteModel = getValue(rc, 'safepaste_gemini_model').asString();
      if (remoteModel && !config.modelOverride.trim()) {
        currentModelName = remoteModel;
      }
      remoteConfigSynced = true;
    } catch {
      remoteConfigSynced = false;
    }

    cachedAi = getAI(cachedApp, { backend: new GoogleAIBackend() });

    currentConnectionState = {
      connected: true,
      appCheckActive,
      remoteConfigSynced,
      activeModel: currentModelName,
    };
    return currentConnectionState;
  } catch (err) {
    cachedAi = null;
    currentConnectionState = {
      connected: false,
      appCheckActive: false,
      remoteConfigSynced: false,
      activeModel: targetModel,
      error: err instanceof Error ? err.message : String(err),
    };
    return currentConnectionState;
  }
}

export function getFirebaseConnectionState(): FirebaseConnectionState {
  return currentConnectionState;
}

/**
 * STAGE 1 & 2: Strictly On-Device Privacy Scan & Tokenization.
 * SECURITY INVARIANT: Raw user text is NEVER passed to cloud-capable inference.
 */
export async function runContextualNanoScan(
  rawText: string,
  customTerms?: CustomTermRule[]
): Promise<NanoScanWithAuditResult> {
  const start = performance.now();
  const nanoStatus = await checkNanoAvailability();
  const engine = new SafePasteEngine();

  const sanitizeResult = await engine.sanitize(rawText, customTerms);
  const latencyMs = Math.round((performance.now() - start) * 100) / 100;

  const usedNano =
    isNanoReady(nanoStatus) &&
    sanitizeResult.entities.some((e) => e.method === 'SEMANTIC_NANO');

  const executionSource: ExecutionSource = usedNano
    ? 'GEMINI_NANO_ON_DEVICE'
    : 'LOCAL_DEMO_ENGINE';

  const auditEntry: NetworkAuditEntry = {
    id: createAuditId(),
    timestamp: new Date().toISOString(),
    stage: 'ON_DEVICE_SCAN',
    mode: 'ONLY_ON_DEVICE',
    executionSource,
    endpoint: usedNano
      ? 'local://chrome-prompt-api (Gemini Nano — Offline)'
      : 'local://safepaste-privacy-engine (Zero-Network Heuristic)',
    outboundPayload: `[LOCAL ONLY — 0 BYTES SENT OVER NETWORK]\nSanitized Output Preview:\n${sanitizeResult.sanitizedText}`,
    rawSecretsChecked: Object.keys(sanitizeResult.tokenMap).length,
    leakedSecretsFound: [],
    zeroLeakageVerified: true,
    latencyMs,
    modelName: usedNano ? 'gemini-nano (on-device)' : 'local-deterministic-v1',
  };

  return {
    sanitizeResult,
    nanoStatus,
    executionSource,
    auditEntry,
  };
}

function buildTaskPrompt(sanitizedText: string, taskType: WorkspaceTaskType): string {
  const preservationNote = SafePasteEngine.getSystemInstruction();

  switch (taskType) {
    case 'SUMMARIZE':
      return `${preservationNote}\n\nTask: Provide a clear, executive summary of the following sanitized text in the same language as the input:\n\n${sanitizedText}`;
    case 'REWRITE_PROFESSIONAL':
      return `${preservationNote}\n\nTask: Rewrite the following sanitized text to sound polished, professional, and clear in the same language as the input:\n\n${sanitizedText}`;
    case 'TRANSLATE_EN_TH':
      return `${preservationNote}\n\nTask: Translate the following sanitized text cleanly between Thai and English (translate Thai into natural English, or English into polite Thai), keeping all [[SP_*]] tokens intact:\n\n${sanitizedText}`;
    case 'CODE_SECURITY_REVIEW':
      return `${preservationNote}\n\nTask: Perform a security and operational risk review on the following sanitized snippet or note. Highlight why the masked credentials/PII posed a risk and suggest remediation steps:\n\n${sanitizedText}`;
    case 'ACTION_ITEMS':
      return `${preservationNote}\n\nTask: Extract a structured bullet list of concrete action items and key entities (using their [[SP_*]] tokens) from the following sanitized text:\n\n${sanitizedText}`;
  }
}

/**
 * Deterministic local transformer used ONLY when neither Firebase credentials nor
 * Chrome Gemini Nano are enabled in the browser (transparently labeled LOCAL_SANDBOX_SIMULATION).
 */
function runLocalSandboxSimulation(
  sanitizedPrompt: string,
  taskType: WorkspaceTaskType,
  tokenMap: Record<string, TokenMapping>
): string {
  const tokens = Object.keys(tokenMap);
  const tokenSummary = tokens.length > 0 ? tokens.join(', ') : 'no sensitive tokens';

  switch (taskType) {
    case 'SUMMARIZE':
      return `[Executive Summary — Local Sandbox]\n• Key Context: ${sanitizedPrompt}\n• Protected Entities Preserved: ${tokenSummary}\n• Recommendation: Configure Firebase API credentials in Settings (top-right) to route sanitized prompts through Firebase AI Logic (${currentModelName}).`;
    case 'REWRITE_PROFESSIONAL':
      return `เรียน ทีมงานที่เกี่ยวข้อง,\n\nขอสรุปรายละเอียดสำคัญเพื่อดำเนินการต่อดังนี้:\n"${sanitizedPrompt}"\n\nทั้งนี้ข้อมูลสำคัญ (${tokenSummary}) ได้รับการปกป้องด้วยระบบ Local Tokenization ของ SafePaste AI แล้วครับ`;
    case 'TRANSLATE_EN_TH':
      return `[Bilingual Safe Translation — Sandbox]\nProcessed Text with Preserved Tokens:\n"${sanitizedPrompt}"\n\nAll protected placeholders (${tokenSummary}) remain intact for local rehydration.`;
    case 'CODE_SECURITY_REVIEW':
      return `[Security Audit Report — Sandbox]\n1. Critical Exposure Mitigated: Detected ${tokens.length} sensitive item(s) [${tokenSummary}] and neutralized them locally before egress.\n2. Context Reviewed: "${sanitizedPrompt}"\n3. Action Required: Rotate any credentials referenced by ${tokens.filter((t) => t.includes('API_KEY') || t.includes('PASSWORD')).join(', ') || 'your environment'} and store secrets in a vault.`;
    case 'ACTION_ITEMS':
      return `[Extracted Action Items — Sandbox]\n- [ ] Verify context involving: ${tokenSummary}\n- [ ] Follow up on statement: "${sanitizedPrompt.slice(0, 120)}${sanitizedPrompt.length > 120 ? '...' : ''}"\n- [ ] Confirm safe delivery with local token rehydration`;
  }
}

/**
 * STAGE 3: Hybrid AI Reasoning via Firebase AI Logic SDK (or local Gemini Nano / transparent Sandbox).
 */
export async function runHybridWorkspaceTask(
  sanitizedPrompt: string,
  taskType: WorkspaceTaskType,
  modeSelection: InferenceModeLabel,
  tokenMap: Record<string, TokenMapping>
): Promise<HybridTaskResult> {
  const start = performance.now();

  // MANDATORY PRE-FLIGHT ZERO-LEAKAGE CHECK
  const leakageCheck = verifyZeroLeakage(sanitizedPrompt, tokenMap);
  if (!leakageCheck.zeroLeakageVerified) {
    const blockedEntry: NetworkAuditEntry = {
      id: createAuditId(),
      timestamp: new Date().toISOString(),
      stage: 'HYBRID_INFERENCE',
      mode: modeSelection,
      executionSource: 'LOCAL_DEMO_ENGINE',
      endpoint: 'ABORTED://zero-leakage-firewall',
      outboundPayload: sanitizedPrompt,
      rawSecretsChecked: leakageCheck.rawSecretsChecked,
      leakedSecretsFound: leakageCheck.leakedSecretsFound,
      zeroLeakageVerified: false,
      latencyMs: Math.round((performance.now() - start) * 100) / 100,
    };
    throw Object.assign(
      new Error(
        `Zero-Leakage Firewall Blocked Egress! Unmasked secret(s) detected: ${leakageCheck.leakedSecretsFound.join(', ')}`
      ),
      { auditEntry: blockedEntry }
    );
  }

  const fullTaskPrompt = buildTaskPrompt(sanitizedPrompt, taskType);

  // Path 1: Official Firebase AI Logic SDK (Hybrid Inference)
  if (cachedAi) {
    try {
      const firebaseMode =
        modeSelection === 'ONLY_ON_DEVICE'
          ? InferenceMode.ONLY_ON_DEVICE
          : modeSelection === 'ONLY_IN_CLOUD'
            ? InferenceMode.ONLY_IN_CLOUD
            : InferenceMode.PREFER_ON_DEVICE;

      const cloudParams: HybridParams = {
        mode: InferenceMode.ONLY_IN_CLOUD,
        inCloudParams: {
          model: currentModelName,
          systemInstruction: SafePasteEngine.getSystemInstruction(),
        },
      };

      const hybridParams: HybridParams = {
        mode: firebaseMode,
        onDeviceParams: {
          createOptions: {
            initialPrompts: [
              {
                role: 'system',
                content: [{ type: 'text', value: SafePasteEngine.getSystemInstruction() }],
              },
            ],
            expectedInputs: [{ type: 'text', languages: ['en'] }],
            expectedOutputs: [{ type: 'text', languages: ['en'] }],
          },
        },
        inCloudParams: cloudParams.inCloudParams,
      };

      const runHybridCall = async () => {
        const model = getGenerativeModel(cachedAi!, hybridParams);
        if (modeSelection !== 'PREFER_ON_DEVICE') {
          return await model.generateContent(fullTaskPrompt);
        }

        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeoutPromise = new Promise<never>((_resolve, reject) => {
            timeoutHandle = setTimeout(
              () => reject(new Error('Firebase on-device hybrid call timed out after 12s')),
              12_000
            );
          });
          return await Promise.race([model.generateContent(fullTaskPrompt), timeoutPromise]);
        } catch {
          const cloudModel = getGenerativeModel(cachedAi!, cloudParams);
          return await cloudModel.generateContent(fullTaskPrompt);
        } finally {
          if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
        }
      };

      const result = await runHybridCall();
      const outputText = result.response.text();
      const latencyMs = Math.round((performance.now() - start) * 100) / 100;

      // Inspect actual inference source reported by Firebase AI Logic SDK (never hardcoded!)
      const ranOnDevice = result.response.inferenceSource === InferenceSource.ON_DEVICE;
      const executionSource: ExecutionSource = ranOnDevice
        ? 'FIREBASE_HYBRID_ON_DEVICE'
        : 'FIREBASE_CLOUD_GEMINI';

      const auditEntry: NetworkAuditEntry = {
        id: createAuditId(),
        timestamp: new Date().toISOString(),
        stage: 'HYBRID_INFERENCE',
        mode: modeSelection,
        executionSource,
        endpoint: ranOnDevice
          ? 'local://firebase-ai-hybrid (Chrome Gemini Nano)'
          : 'https://firebasevertexai.googleapis.com (Firebase AI Logic + App Check)',
        outboundPayload: sanitizedPrompt,
        rawSecretsChecked: leakageCheck.rawSecretsChecked,
        leakedSecretsFound: [],
        zeroLeakageVerified: true,
        latencyMs,
        modelName: ranOnDevice ? 'gemini-nano' : currentModelName,
      };

      return { outputText, executionSource, latencyMs, auditEntry };
    } catch (firebaseErr) {
      if (modeSelection === 'ONLY_IN_CLOUD') {
        throw firebaseErr;
      }
    }
  }

  // Path 2: Direct Chrome Built-in Gemini Nano when Firebase API key is not configured
  const nanoStatus = await checkNanoAvailability();
  if (isNanoReady(nanoStatus) && modeSelection !== 'ONLY_IN_CLOUD') {
    const win = window as unknown as {
      LanguageModel?: {
        create: (opts?: Record<string, unknown>) => Promise<{
          prompt: (input: string) => Promise<string>;
          destroy: () => void;
        }>;
      };
      ai?: {
        languageModel?: {
          create: (opts?: Record<string, unknown>) => Promise<{
            prompt: (input: string) => Promise<string>;
            destroy: () => void;
          }>;
        };
      };
    };

    const lm = win.LanguageModel || win.ai?.languageModel;
    if (lm) {
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      let session: { prompt: (input: string) => Promise<string>; destroy: () => void } | undefined;

      try {
        const runNanoTask = async (): Promise<string> => {
          try {
            session = await lm.create({
              initialPrompts: [
                { role: 'system', content: SafePasteEngine.getSystemInstruction() },
              ],
              expectedInputs: [{ type: 'text', languages: ['en'] }],
              expectedOutputs: [{ type: 'text', languages: ['en'] }],
            });
          } catch {
            session = await lm.create({
              systemPrompt: SafePasteEngine.getSystemInstruction(),
            });
          }
          return await session.prompt(fullTaskPrompt);
        };

        const timeoutPromise = new Promise<never>((_resolve, reject) => {
          timeoutHandle = setTimeout(
            () => reject(new Error('Chrome Gemini Nano inference timed out after 15s')),
            15_000
          );
        });

        const outputText = await Promise.race([runNanoTask(), timeoutPromise]);
        const latencyMs = Math.round((performance.now() - start) * 100) / 100;

        const auditEntry: NetworkAuditEntry = {
          id: createAuditId(),
          timestamp: new Date().toISOString(),
          stage: 'HYBRID_INFERENCE',
          mode: modeSelection,
          executionSource: 'GEMINI_NANO_ON_DEVICE',
          endpoint: 'local://chrome-prompt-api-nano (On-Device)',
          outboundPayload: sanitizedPrompt,
          rawSecretsChecked: leakageCheck.rawSecretsChecked,
          leakedSecretsFound: [],
          zeroLeakageVerified: true,
          latencyMs,
          modelName: 'gemini-nano',
        };

        return {
          outputText,
          executionSource: 'GEMINI_NANO_ON_DEVICE',
          latencyMs,
          auditEntry,
        };
      } catch (nanoErr) {
        if (modeSelection === 'ONLY_ON_DEVICE') {
          throw nanoErr;
        }
        // Under PREFER_ON_DEVICE without Firebase keys, fall back transparently to Sandbox Simulation
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
        try {
          session?.destroy();
        } catch {
          // Ignore
        }
      }
    }
  }

  if (modeSelection === 'ONLY_IN_CLOUD') {
    throw new Error(
      'ONLY_IN_CLOUD mode selected, but Firebase credentials are not configured. Open Settings to enter your Firebase API Key, Project ID, and App ID.'
    );
  }

  // Path 3: Transparent Local Sandbox Simulation (when neither Firebase keys nor Chrome Nano flag are enabled)
  const outputText = runLocalSandboxSimulation(sanitizedPrompt, taskType, tokenMap);
  const latencyMs = Math.round((performance.now() - start) * 100) / 100;

  const auditEntry: NetworkAuditEntry = {
    id: createAuditId(),
    timestamp: new Date().toISOString(),
    stage: 'HYBRID_INFERENCE',
    mode: modeSelection,
    executionSource: 'LOCAL_SANDBOX_SIMULATION',
    endpoint: 'local://sandbox-transformer (Configure Firebase or Enable Chrome Nano)',
    outboundPayload: sanitizedPrompt,
    rawSecretsChecked: leakageCheck.rawSecretsChecked,
    leakedSecretsFound: [],
    zeroLeakageVerified: true,
    latencyMs,
    modelName: 'sandbox-local-v1',
  };

  return {
    outputText,
    executionSource: 'LOCAL_SANDBOX_SIMULATION',
    latencyMs,
    auditEntry,
  };
}
