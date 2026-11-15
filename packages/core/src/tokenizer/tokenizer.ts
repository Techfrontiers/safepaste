import { DetectedEntity, SanitizeResult, SensitiveCategory, TokenMapping } from '../types/index.js';

export class SafePasteTokenizer {
  private categoryCounters: Map<SensitiveCategory, number> = new Map();
  private valueToTokenMap: Map<string, string> = new Map();
  private tokenMap: Map<string, TokenMapping> = new Map();

  /**
   * Resets tokenizer state for a fresh session
   */
  public reset(): void {
    this.categoryCounters.clear();
    this.valueToTokenMap.clear();
    this.tokenMap.clear();
  }

  /**
   * Gets or generates an invariant token for a given value and category.
   * Ensures identical values across the prompt receive the exact same token.
   */
  private getOrCreateToken(category: SensitiveCategory, rawValue: string): string {
    const existingToken = this.valueToTokenMap.get(rawValue);
    if (existingToken) {
      return existingToken;
    }

    const currentCount = (this.categoryCounters.get(category) || 0) + 1;
    this.categoryCounters.set(category, currentCount);

    const paddedId = String(currentCount).padStart(2, '0');
    const token = `[[SP_${category}_${paddedId}]]`;

    this.valueToTokenMap.set(rawValue, token);
    this.tokenMap.set(token, {
      token,
      rawValue,
      category,
      id: `${category}_${paddedId}`,
    });

    return token;
  }

  /**
   * Replaces all detected entities with invariant tokens.
   * Operates from right to left (descending order of startIndex) to maintain character offsets.
   */
  public tokenize(originalText: string, entities: DetectedEntity[]): SanitizeResult {
    this.reset();
    const startTime = performance.now();

    // Deduplicate and resolve overlapping entities (give priority to longer match or higher confidence)
    const sortedEntities = [...entities].sort((a, b) => {
      if (a.startIndex !== b.startIndex) {
        return a.startIndex - b.startIndex;
      }
      return b.rawValue.length - a.rawValue.length;
    });

    const nonOverlapping: DetectedEntity[] = [];
    let lastEnd = -1;

    for (const entity of sortedEntities) {
      if (entity.startIndex >= lastEnd) {
        nonOverlapping.push(entity);
        lastEnd = entity.endIndex;
      }
    }

    // Sort descending by startIndex for in-place string replacement
    const replacementList = [...nonOverlapping].sort((a, b) => b.startIndex - a.startIndex);

    let sanitizedText = originalText;
    const categoryMetrics: Record<string, number> = {};

    for (const entity of replacementList) {
      const token = this.getOrCreateToken(entity.category, entity.rawValue);
      categoryMetrics[entity.category] = (categoryMetrics[entity.category] || 0) + 1;

      sanitizedText =
        sanitizedText.slice(0, entity.startIndex) +
        token +
        sanitizedText.slice(entity.endIndex);
    }

    const scanTimeMs = Math.round((performance.now() - startTime) * 100) / 100;
    const tokenMapRecord: Record<string, TokenMapping> = {};
    for (const [key, val] of this.tokenMap.entries()) {
      tokenMapRecord[key] = val;
    }

    return {
      originalText,
      sanitizedText,
      tokenMap: tokenMapRecord,
      entities: nonOverlapping,
      metrics: {
        detectedCount: nonOverlapping.length,
        scanTimeMs,
        categories: categoryMetrics,
      },
    };
  }
}
