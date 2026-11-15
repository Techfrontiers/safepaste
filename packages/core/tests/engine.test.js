import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SafePasteEngine } from '../dist/engine.js';

describe('SafePasteEngine Full Pipeline Simulation', () => {
  test('executes end-to-end PII masking and rehydration cycle', async () => {
    const engine = new SafePasteEngine();

    // 1. Raw prompt containing PII, API Key, and financial figure
    const rawPrompt = 'Notify CEO Somchai at somchai@scg.com that Project Pegasus secured 15,000,000 บาท using API key AIzaSyD-99887766554433221100aabbccddeeff';

    // 2. Local sanitize (Stage 1 & 2)
    const sanitizeResult = await engine.sanitize(rawPrompt);

    // Verify raw prompt was masked
    assert.notStrictEqual(sanitizeResult.sanitizedText, rawPrompt);
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_EMAIL_01]]'));
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_API_KEY_01]]'));
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_MONEY_01]]'));
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_PROJECT_SECRET_01]]'));

    // Critical invariant check: NO raw secrets exist in the sanitized text!
    assert.strictEqual(sanitizeResult.sanitizedText.includes('somchai@scg.com'), false);
    assert.strictEqual(sanitizeResult.sanitizedText.includes('AIzaSyD-99887766554433221100aabbccddeeff'), false);
    assert.strictEqual(sanitizeResult.sanitizedText.includes('15,000,000 บาท'), false);

    // 3. Simulate Cloud AI (Stage 3): Cloud AI summarizes the sanitized text
    const mockCloudAiResponse = 'Summary: Notification dispatched to [[SP_EMAIL_01]]. [[SP_PROJECT_SECRET_01]] funding confirmed at [[SP_MONEY_01]] with key [[SP_API_KEY_01]].';

    // 4. Local Rehydrate (Stage 4)
    const rehydrateResult = engine.rehydrate(mockCloudAiResponse, sanitizeResult.tokenMap);

    // 5. Verification
    assert.strictEqual(rehydrateResult.isClean, true);
    assert.ok(rehydrateResult.rehydratedText.includes('somchai@scg.com'));
    assert.ok(rehydrateResult.rehydratedText.includes('Project Pegasus'));
    assert.ok(rehydrateResult.rehydratedText.includes('15,000,000 บาท'));
    assert.ok(rehydrateResult.rehydratedText.includes('AIzaSyD-99887766554433221100aabbccddeeff'));
  });
});
