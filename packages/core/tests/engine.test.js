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
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_PERSON_01]]'));
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_EMAIL_01]]'));
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_API_KEY_01]]'));
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_MONEY_01]]'));
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_PROJECT_SECRET_01]]'));

    // Critical invariant check: NO raw secrets exist in the sanitized text!
    assert.strictEqual(sanitizeResult.sanitizedText.includes('CEO Somchai'), false);
    assert.strictEqual(sanitizeResult.sanitizedText.includes('somchai@scg.com'), false);
    assert.strictEqual(sanitizeResult.sanitizedText.includes('AIzaSyD-99887766554433221100aabbccddeeff'), false);
    assert.strictEqual(sanitizeResult.sanitizedText.includes('15,000,000 บาท'), false);

    // 3. Simulate Cloud AI (Stage 3): Cloud AI summarizes the sanitized text
    const mockCloudAiResponse = 'Summary for [[SP_PERSON_01]]: Notification dispatched to [[SP_EMAIL_01]]. [[SP_PROJECT_SECRET_01]] funding confirmed at [[SP_MONEY_01]] with key [[SP_API_KEY_01]].';

    // 4. Local Rehydrate (Stage 4)
    const rehydrateResult = engine.rehydrate(mockCloudAiResponse, sanitizeResult.tokenMap);

    // 5. Verification
    assert.strictEqual(rehydrateResult.isClean, true);
    assert.ok(rehydrateResult.rehydratedText.includes('CEO Somchai'));
    assert.ok(rehydrateResult.rehydratedText.includes('somchai@scg.com'));
    assert.ok(rehydrateResult.rehydratedText.includes('Project Pegasus'));
    assert.ok(rehydrateResult.rehydratedText.includes('15,000,000 บาท'));
    assert.ok(rehydrateResult.rehydratedText.includes('AIzaSyD-99887766554433221100aabbccddeeff'));
  });

  test('detects Thai ORGANIZATION, MONEY, and PERSON entities and rehydrates cleanly', async () => {
    const engine = new SafePasteEngine();
    const rawPrompt = 'บริษัท SCG มียอดขาย 15,400,000 บาท และมีลูกหนี้ชื่อคุณสมชาย';

    const sanitizeResult = await engine.sanitize(rawPrompt);

    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_ORGANIZATION_01]]'));
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_MONEY_01]]'));
    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_PERSON_01]]'));
    assert.strictEqual(sanitizeResult.sanitizedText.includes('SCG'), false);
    assert.strictEqual(sanitizeResult.sanitizedText.includes('15,400,000 บาท'), false);
    assert.strictEqual(sanitizeResult.sanitizedText.includes('คุณสมชาย'), false);

    const mockCloudResponse = 'สรุป: [[SP_ORGANIZATION_01]] รายงานยอด [[SP_MONEY_01]] โดยมีลูกหนี้คือ [[SP_PERSON_01]]';
    const rehydrateResult = engine.rehydrate(mockCloudResponse, sanitizeResult.tokenMap);

    assert.strictEqual(rehydrateResult.isClean, true);
    assert.strictEqual(
      rehydrateResult.rehydratedText,
      'สรุป: บริษัท SCG รายงานยอด 15,400,000 บาท โดยมีลูกหนี้คือ คุณสมชาย'
    );
  });

  test('supports user-defined customTerms masking and rehydration', async () => {
    const engine = new SafePasteEngine();
    const rawPrompt = 'Deploy AlphaVault before Friday.';

    const sanitizeResult = await engine.sanitize(rawPrompt, [
      { value: 'AlphaVault', category: 'CUSTOM' },
    ]);

    assert.ok(sanitizeResult.sanitizedText.includes('[[SP_CUSTOM_01]]'));
    assert.strictEqual(sanitizeResult.sanitizedText.includes('AlphaVault'), false);

    const rehydrateResult = engine.rehydrate('Ready to deploy [[SP_CUSTOM_01]] on schedule.', sanitizeResult.tokenMap);
    assert.strictEqual(rehydrateResult.rehydratedText, 'Ready to deploy AlphaVault on schedule.');
  });
});
