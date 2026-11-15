export type SensitiveCategory =
  | 'API_KEY'
  | 'PASSWORD'
  | 'EMAIL'
  | 'PHONE'
  | 'CREDIT_CARD'
  | 'NATIONAL_ID'
  | 'IP_ADDRESS'
  | 'MONEY'
  | 'PERSON'
  | 'ORGANIZATION'
  | 'PROJECT_SECRET'
  | 'CUSTOM';

export type DetectionMethod =
  | 'DETERMINISTIC_REGEX'
  | 'SEMANTIC_NANO'
  | 'USER_DEFINED';

export interface DetectedEntity {
  id: string;
  category: SensitiveCategory;
  rawValue: string;
  startIndex: number;
  endIndex: number;
  method: DetectionMethod;
  confidence: number;
  metadata?: Record<string, unknown>;
}

export interface TokenMapping {
  token: string;
  rawValue: string;
  category: SensitiveCategory;
  id: string;
}

export interface SanitizeResult {
  originalText: string;
  sanitizedText: string;
  tokenMap: Record<string, TokenMapping>;
  entities: DetectedEntity[];
  metrics: {
    detectedCount: number;
    scanTimeMs: number;
    categories: Record<string, number>;
  };
}

export interface RehydrateResult {
  rehydratedText: string;
  restoredTokens: string[];
  missingTokens: string[];
  alteredTokens: string[];
  isClean: boolean;
}

export interface ISemanticDetector {
  detect(text: string): Promise<DetectedEntity[]>;
  isAvailable(): Promise<boolean>;
}
