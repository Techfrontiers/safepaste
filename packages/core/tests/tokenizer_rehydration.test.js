import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SafePasteTokenizer } from '../dist/tokenizer/tokenizer.js';
import { SafePasteRehydrator } from '../dist/rehydration/rehydration.js';

describe('SafePaste Invariant Tokenizer & Rehydration', () => {
  test('replaces sensitive entities with [[SP_*]] tokens from right to left', () => {
    const original = 'Send payment to john@example.com or backup to john@example.com';
    const entities = [
      {
        id: '1',
        category: 'EMAIL',
        rawValue: 'john@example.com',
        startIndex: 16,
        endIndex: 32,
        method: 'DETERMINISTIC_REGEX',
        confidence: 1.0,
      },
      {
        id: '2',
        category: 'EMAIL',
        rawValue: 'john@example.com',
        startIndex: 46,
        endIndex: 62,
        method: 'DETERMINISTIC_REGEX',
        confidence: 1.0,
      },
    ];

    const tokenizer = new SafePasteTokenizer();
    const result = tokenizer.tokenize(original, entities);

    // Both identical emails should share the exact same token [[SP_EMAIL_01]]
    assert.strictEqual(result.sanitizedText, 'Send payment to [[SP_EMAIL_01]] or backup to [[SP_EMAIL_01]]');
    assert.strictEqual(result.tokenMap['[[SP_EMAIL_01]]'].rawValue, 'john@example.com');
  });

  test('rehydrates exact tokens back to original values', () => {
    const aiResponse = 'Here is the summary: We contacted [[SP_EMAIL_01]] and key is [[SP_API_KEY_01]].';
    const tokenMap = {
      '[[SP_EMAIL_01]]': {
        token: '[[SP_EMAIL_01]]',
        rawValue: 'ceo@techfrontiers.dev',
        category: 'EMAIL',
        id: 'EMAIL_01',
      },
      '[[SP_API_KEY_01]]': {
        token: '[[SP_API_KEY_01]]',
        rawValue: 'AIzaSyD-SecretKey',
        category: 'API_KEY',
        id: 'API_KEY_01',
      },
    };

    const rehydrator = new SafePasteRehydrator();
    const rehydrated = rehydrator.rehydrate(aiResponse, tokenMap);

    assert.strictEqual(
      rehydrated.rehydratedText,
      'Here is the summary: We contacted ceo@techfrontiers.dev and key is AIzaSyD-SecretKey.'
    );
    assert.strictEqual(rehydrated.isClean, true);
    assert.strictEqual(rehydrated.restoredTokens.length, 2);
  });

  test('safely recovers altered or loose tokens (Fuzzy Tolerance)', () => {
    // If the LLM alters casing or drops one bracket: [SP_API_KEY_01] or [[ sp_api_key_01 ]]
    const aiAlteredResponse = 'Configuration verified for [SP_API_KEY_01] successfully.';
    const tokenMap = {
      '[[SP_API_KEY_01]]': {
        token: '[[SP_API_KEY_01]]',
        rawValue: 'AIzaSyD-SecretKey',
        category: 'API_KEY',
        id: 'API_KEY_01',
      },
    };

    const rehydrator = new SafePasteRehydrator();
    const rehydrated = rehydrator.rehydrate(aiAlteredResponse, tokenMap);

    assert.strictEqual(
      rehydrated.rehydratedText,
      'Configuration verified for AIzaSyD-SecretKey successfully.'
    );
    assert.strictEqual(rehydrated.alteredTokens.includes('[[SP_API_KEY_01]]'), true);
    assert.strictEqual(rehydrated.restoredTokens.length, 1);
  });

  test('flags missing tokens if LLM dropped them', () => {
    const aiTruncatedResponse = 'I cannot process this request.';
    const tokenMap = {
      '[[SP_API_KEY_01]]': {
        token: '[[SP_API_KEY_01]]',
        rawValue: 'AIzaSyD-SecretKey',
        category: 'API_KEY',
        id: 'API_KEY_01',
      },
    };

    const rehydrator = new SafePasteRehydrator();
    const rehydrated = rehydrator.rehydrate(aiTruncatedResponse, tokenMap);

    assert.strictEqual(rehydrated.isClean, false);
    assert.strictEqual(rehydrated.missingTokens.includes('[[SP_API_KEY_01]]'), true);
  });
});
