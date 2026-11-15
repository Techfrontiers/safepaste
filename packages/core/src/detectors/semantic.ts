import { DetectedEntity, ISemanticDetector, SensitiveCategory } from '../types/index.js';

export interface PromptApiSession {
  prompt(input: string): Promise<string>;
  destroy(): void;
}

export interface PromptApiWindow {
  ai?: {
    languageModel?: {
      availability(): Promise<'readily' | 'after-download' | 'no'>;
      create(options?: { systemPrompt?: string }): Promise<PromptApiSession>;
    };
  };
  LanguageModel?: {
    availability(): Promise<'readily' | 'after-download' | 'no'>;
    create(options?: { systemPrompt?: string }): Promise<PromptApiSession>;
  };
}

export const SEMANTIC_SYSTEM_PROMPT = `You are a high-speed local privacy analyzer.
Analyze the user text and identify sensitive contextual entities that are NOT captured by simple regex:
1. PERSON: Names of individuals (e.g. Somchai, John Doe)
2. ORGANIZATION: Proprietary company or client names (e.g. Acme Corp, SCG)
3. MONEY: Proprietary financial figures (e.g. 15,400,000 THB, $5.2M)
4. PROJECT_SECRET: Internal code names or secret project labels (e.g. Project Pegasus, Apollo-99)

Output strictly a JSON array of objects with keys: "value" (exact substring) and "category" (one of PERSON, ORGANIZATION, MONEY, PROJECT_SECRET).
If no sensitive entity is found, output []. Do not output markdown backticks or explanations.`;

/**
 * Semantic Detector implementing Gemini Nano Built-in Prompt API with Graceful Offline Heuristics
 */
export class NanoSemanticDetector implements ISemanticDetector {
  private windowObj: PromptApiWindow | null;

  constructor(customWindow?: PromptApiWindow) {
    if (customWindow) {
      this.windowObj = customWindow;
    } else if (typeof window !== 'undefined') {
      this.windowObj = window as unknown as PromptApiWindow;
    } else {
      this.windowObj = null;
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.windowObj) return false;
    try {
      const lm = this.windowObj.LanguageModel || this.windowObj.ai?.languageModel;
      if (!lm) return false;
      const status = await lm.availability();
      return status === 'readily';
    } catch {
      return false;
    }
  }

  async detect(text: string): Promise<DetectedEntity[]> {
    const isReady = await this.isAvailable();
    if (!isReady) {
      // Fallback to local heuristic contextual detection when Gemini Nano is not ready/downloaded
      return this.heuristicFallback(text);
    }

    try {
      const lm = this.windowObj?.LanguageModel || this.windowObj?.ai?.languageModel;
      if (!lm) return this.heuristicFallback(text);

      const session = await lm.create({ systemPrompt: SEMANTIC_SYSTEM_PROMPT });
      const rawResponse = await session.prompt(text);
      session.destroy();

      return this.parseNanoResponse(text, rawResponse);
    } catch {
      return this.heuristicFallback(text);
    }
  }

  private parseNanoResponse(originalText: string, rawResponse: string): DetectedEntity[] {
    const entities: DetectedEntity[] = [];
    try {
      // Strip possible markdown fences
      const cleanJson = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed: Array<{ value: string; category: SensitiveCategory }> = JSON.parse(cleanJson);

      let counter = 1;
      for (const item of parsed) {
        if (!item.value || !item.category) continue;
        const index = originalText.indexOf(item.value);
        if (index !== -1) {
          entities.push({
            id: `nano_${item.category.toLowerCase()}_${counter++}`,
            category: item.category,
            rawValue: item.value,
            startIndex: index,
            endIndex: index + item.value.length,
            method: 'SEMANTIC_NANO',
            confidence: 0.92,
          });
        }
      }
    } catch {
      // JSON parse failed; return empty or fallback
    }
    return entities;
  }

  /**
   * Offline zero-dependency heuristic parser for development, testing, and offline fallback
   */
  private heuristicFallback(text: string): DetectedEntity[] {
    const entities: DetectedEntity[] = [];
    let counter = 1;

    // Pattern A: Thai/English Currency & Monetary figures (e.g. 15,400,000 บาท, $2.5M, 50,000 USD)
    const moneyPattern = /(?:[\$฿€£]\s?\d+(?:,\d{3})*(?:\.\d+)?(?:\s?(?:M|B|K|บาท|USD|THB))?|\b\d+(?:,\d{3})*(?:\.\d+)?\s?(?:บาท|THB|USD|EUR|THB))(?![a-zA-Z0-9_])/g;
    let match: RegExpExecArray | null;
    while ((match = moneyPattern.exec(text)) !== null) {
      entities.push({
        id: `nano_money_${counter++}`,
        category: 'MONEY',
        rawValue: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        method: 'SEMANTIC_NANO',
        confidence: 0.85,
      });
    }

    // Pattern B: Secret project indicators (e.g. Project Pegasus, Operation Phoenix)
    const projectPattern = /(?<![a-zA-Z0-9_])(?:Project|Operation|โปรเจกต์|โครงการ)\s+([ก-๙A-Za-z0-9_-]+)(?![a-zA-Z0-9_])/gi;
    while ((match = projectPattern.exec(text)) !== null) {
      entities.push({
        id: `nano_project_${counter++}`,
        category: 'PROJECT_SECRET',
        rawValue: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        method: 'SEMANTIC_NANO',
        confidence: 0.88,
      });
    }

    // Pattern C: Person names with Thai or English honorifics/titles
    const personPattern = /(?:คุณ\s*[ก-๙A-Za-z]+|(?:นาย|นางสาว|นาง|ดร\.)\s+[ก-๙A-Za-z]+(?:\s+[ก-๙A-Za-z]+)?|(?:CEO|CFO|CTO|Mr\.|Ms\.|Mrs\.|Dr\.)\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)/g;
    while ((match = personPattern.exec(text)) !== null) {
      entities.push({
        id: `nano_person_${counter++}`,
        category: 'PERSON',
        rawValue: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        method: 'SEMANTIC_NANO',
        confidence: 0.86,
      });
    }

    // Pattern D: Thai and English organization/company names
    const orgPattern = /(?:บริษัท\s+[ก-๙A-Za-z0-9_.-]+(?:\s+จำกัด(?:\s*\(มหาชน\))?)?|\b[A-Z][A-Za-z0-9&-]+\s+(?:Corp|Corporation|Inc|Ltd|LLC|Group|Enterprise|Technologies|Bank)\b)/g;
    while ((match = orgPattern.exec(text)) !== null) {
      entities.push({
        id: `nano_org_${counter++}`,
        category: 'ORGANIZATION',
        rawValue: match[0],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        method: 'SEMANTIC_NANO',
        confidence: 0.87,
      });
    }

    return entities;
  }
}
