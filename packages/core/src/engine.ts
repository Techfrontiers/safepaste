import { scanDeterministic } from './detectors/deterministic.js';
import { NanoSemanticDetector } from './detectors/semantic.js';
import { SafePasteTokenizer } from './tokenizer/tokenizer.js';
import { SafePasteRehydrator } from './rehydration/rehydration.js';
import { DetectedEntity, ISemanticDetector, RehydrateResult, SanitizeResult, SensitiveCategory, TokenMapping } from './types/index.js';

export interface CustomTermRule {
  value: string;
  category: SensitiveCategory;
}

export interface SafePasteEngineOptions {
  semanticDetector?: ISemanticDetector;
  enableSemantic?: boolean;
}

export class SafePasteEngine {
  private semanticDetector: ISemanticDetector;
  private tokenizer: SafePasteTokenizer;
  private rehydrator: SafePasteRehydrator;
  private enableSemantic: boolean;

  constructor(options?: SafePasteEngineOptions) {
    this.semanticDetector = options?.semanticDetector || new NanoSemanticDetector();
    this.enableSemantic = options?.enableSemantic ?? true;
    this.tokenizer = new SafePasteTokenizer();
    this.rehydrator = new SafePasteRehydrator();
  }

  /**
   * System instruction appended to LLM requests to ensure token preservation
   */
  public static getSystemInstruction(): string {
    return 'CRITICAL PRIVACY INSTRUCTION: You must preserve all placeholder tokens formatted as [[SP_*]] exactly as written in your output. Do not translate, change casing, reformat, or omit these tokens.';
  }

  /**
   * Scans text locally on-device without modifying it
   */
  public async scan(text: string, customTerms?: CustomTermRule[]): Promise<DetectedEntity[]> {
    // 1. High-precision deterministic scan
    const deterministicEntities = scanDeterministic(text);

    // 2. Semantic scan (Gemini Nano on-device or heuristic fallback)
    let semanticEntities: DetectedEntity[] = [];
    if (this.enableSemantic) {
      semanticEntities = await this.semanticDetector.detect(text);
    }

    // 3. User-defined custom terms
    const customEntities: DetectedEntity[] = [];
    if (customTerms && customTerms.length > 0) {
      let customCounter = 1;
      for (const term of customTerms) {
        const trimmed = term.value.trim();
        if (!trimmed) continue;
        let searchIndex = 0;
        while (searchIndex < text.length) {
          const foundIndex = text.indexOf(trimmed, searchIndex);
          if (foundIndex === -1) break;
          customEntities.push({
            id: `custom_${term.category.toLowerCase()}_${customCounter++}`,
            category: term.category,
            rawValue: trimmed,
            startIndex: foundIndex,
            endIndex: foundIndex + trimmed.length,
            method: 'USER_DEFINED',
            confidence: 1.0,
          });
          searchIndex = foundIndex + trimmed.length;
        }
      }
    }

    // Merge and return all detected entities
    return [...customEntities, ...deterministicEntities, ...semanticEntities];
  }

  /**
   * Full privacy pipeline: Scan on-device -> Replace with invariant tokens -> Return sanitized prompt + local token map
   */
  public async sanitize(text: string, customTerms?: CustomTermRule[]): Promise<SanitizeResult> {
    const entities = await this.scan(text, customTerms);
    return this.tokenizer.tokenize(text, entities);
  }

  /**
   * Tokenizes a pre-filtered list of entities (useful when user toggles individual detections in UI)
   */
  public tokenizeEntities(text: string, entities: DetectedEntity[]): SanitizeResult {
    return this.tokenizer.tokenize(text, entities);
  }

  /**
   * Restores sanitized tokens in the AI response
   */
  public rehydrate(aiResponse: string, tokenMap: Record<string, TokenMapping>): RehydrateResult {
    return this.rehydrator.rehydrate(aiResponse, tokenMap);
  }
}
