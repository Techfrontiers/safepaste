import { scanDeterministic } from './detectors/deterministic.js';
import { NanoSemanticDetector } from './detectors/semantic.js';
import { SafePasteTokenizer } from './tokenizer/tokenizer.js';
import { SafePasteRehydrator } from './rehydration/rehydration.js';
import { DetectedEntity, ISemanticDetector, RehydrateResult, SanitizeResult, TokenMapping } from './types/index.js';

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
  public async scan(text: string): Promise<DetectedEntity[]> {
    // 1. High-precision deterministic scan
    const deterministicEntities = scanDeterministic(text);

    // 2. Semantic scan (Gemini Nano on-device or heuristic fallback)
    let semanticEntities: DetectedEntity[] = [];
    if (this.enableSemantic) {
      semanticEntities = await this.semanticDetector.detect(text);
    }

    // Merge and return all detected entities
    return [...deterministicEntities, ...semanticEntities];
  }

  /**
   * Full privacy pipeline: Scan on-device -> Replace with invariant tokens -> Return sanitized prompt + local token map
   */
  public async sanitize(text: string): Promise<SanitizeResult> {
    const entities = await this.scan(text);
    return this.tokenizer.tokenize(text, entities);
  }

  /**
   * Restores sanitized tokens in the AI response
   */
  public rehydrate(aiResponse: string, tokenMap: Record<string, TokenMapping>): RehydrateResult {
    return this.rehydrator.rehydrate(aiResponse, tokenMap);
  }
}
