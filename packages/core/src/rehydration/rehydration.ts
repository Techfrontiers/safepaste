import { RehydrateResult, TokenMapping } from '../types/index.js';

export class SafePasteRehydrator {
  /**
   * Restores sanitized tokens within an AI generated response using the local secret map.
   * Includes invariant tolerance for slight casing, whitespace, or bracket formatting variations.
   */
  public rehydrate(aiResponseText: string, tokenMap: Record<string, TokenMapping>): RehydrateResult {
    let rehydratedText = aiResponseText;
    const restoredTokens: string[] = [];
    const alteredTokens: string[] = [];
    const missingTokens: string[] = [];

    const tokenEntries = Object.entries(tokenMap);

    for (const [canonicalToken, mapping] of tokenEntries) {
      // Step 1: Direct exact match
      if (rehydratedText.includes(canonicalToken)) {
        // Use global replacement to replace all occurrences
        rehydratedText = rehydratedText.split(canonicalToken).join(mapping.rawValue);
        restoredTokens.push(canonicalToken);
        continue;
      }

      // Step 2: Invariant fuzzy recovery (tolerance for [SP_...], [[ sp_... ]], or case changes)
      // Extract the internal identifier e.g. "API_KEY_01" from "[[SP_API_KEY_01]]"
      const innerIdMatch = canonicalToken.match(/\[\[SP_([A-Za-z0-9_]+)\]\]/);
      if (innerIdMatch) {
        const innerId = innerIdMatch[1];
        // Regex pattern tolerant of single bracket, internal spaces, and case-insensitivity
        const fuzzyPattern = new RegExp(`\\[{1,2}\\s*SP_${innerId}\\s*\\]{1,2}`, 'gi');

        if (fuzzyPattern.test(rehydratedText)) {
          rehydratedText = rehydratedText.replace(fuzzyPattern, mapping.rawValue);
          alteredTokens.push(canonicalToken);
          restoredTokens.push(canonicalToken);
          continue;
        }
      }

      // Step 3: Token was completely dropped or not returned by AI
      missingTokens.push(canonicalToken);
    }

    const isClean = missingTokens.length === 0;

    return {
      rehydratedText,
      restoredTokens,
      missingTokens,
      alteredTokens,
      isClean,
    };
  }
}
