import type { TokenMapping } from '@safepaste/core';

export type InferenceModeLabel = 'ONLY_ON_DEVICE' | 'PREFER_ON_DEVICE' | 'ONLY_IN_CLOUD';

export type ExecutionSource =
  | 'GEMINI_NANO_ON_DEVICE'
  | 'FIREBASE_HYBRID_ON_DEVICE'
  | 'FIREBASE_CLOUD_GEMINI'
  | 'LOCAL_SANDBOX_SIMULATION'
  | 'LOCAL_DEMO_ENGINE';

export interface NetworkAuditEntry {
  id: string;
  timestamp: string;
  stage: 'ON_DEVICE_SCAN' | 'HYBRID_INFERENCE';
  mode: InferenceModeLabel;
  executionSource: ExecutionSource;
  endpoint: string;
  outboundPayload: string;
  rawSecretsChecked: number;
  leakedSecretsFound: string[];
  zeroLeakageVerified: boolean;
  latencyMs: number;
  modelName?: string;
}

export interface ZeroLeakageVerificationResult {
  zeroLeakageVerified: boolean;
  leakedSecretsFound: string[];
  rawSecretsChecked: number;
}

/**
 * Cryptographic-style invariant check run immediately before ANY outbound payload
 * can cross into hybrid/cloud AI inference. Ensures zero unmasked secrets leave the device.
 */
export function verifyZeroLeakage(
  outboundPayload: string,
  tokenMap: Record<string, TokenMapping>
): ZeroLeakageVerificationResult {
  const mappings = Object.values(tokenMap);
  const leakedSecretsFound: string[] = [];

  for (const mapping of mappings) {
    if (!mapping.rawValue) continue;
    if (outboundPayload.includes(mapping.rawValue)) {
      leakedSecretsFound.push(mapping.token);
    }
  }

  return {
    zeroLeakageVerified: leakedSecretsFound.length === 0,
    leakedSecretsFound,
    rawSecretsChecked: mappings.length,
  };
}

export function createAuditId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().slice(0, 8);
  }
  return Math.random().toString(36).slice(2, 10);
}
