import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scanDeterministic, validateLuhn, validateThaiCitizenId } from '../dist/detectors/deterministic.js';

describe('Deterministic PII & Secret Detectors', () => {
  test('validates Thai National ID check-digit correctly', () => {
    // Valid sample Thai citizen IDs
    assert.strictEqual(validateThaiCitizenId('1-1002-01234-56-1'), true);
    // Invalid check-digit
    assert.strictEqual(validateThaiCitizenId('1-1002-01234-56-9'), false);
    // Invalid length
    assert.strictEqual(validateThaiCitizenId('1234'), false);
  });

  test('validates Credit Card using Luhn algorithm', () => {
    // Valid standard test card numbers (Visa test card)
    assert.strictEqual(validateLuhn('4111-1111-1111-1111'), true);
    // Invalid checksum card
    assert.strictEqual(validateLuhn('4111-1111-1111-1112'), false);
  });

  test('detects Google Gemini and Cloud API keys', () => {
    const text = 'Here is my secret Google key: AIzaSyD3xAmPl3K3y-1234567890abcdefghijkl for testing';
    const entities = scanDeterministic(text);
    assert.strictEqual(entities.length, 1);
    assert.strictEqual(entities[0].category, 'API_KEY');
    assert.strictEqual(entities[0].rawValue, 'AIzaSyD3xAmPl3K3y-1234567890abcdefghijkl');
  });

  test('detects OpenAI and GitHub API keys', () => {
    const text = 'OPENAI: sk-proj-1234567890abcdefghijklmnopqrstuvwxyz123456 and GITHUB: ghp_1234567890abcdefghijklmnopqrstuvwxyz';
    const entities = scanDeterministic(text);
    assert.strictEqual(entities.length, 2);
    assert.strictEqual(entities[0].category, 'API_KEY');
    assert.strictEqual(entities[1].category, 'API_KEY');
  });

  test('detects Passwords and Auth Tokens in config strings', () => {
    const text = 'database: postgres, password: "SuperSecretPassword123!", host: localhost';
    const entities = scanDeterministic(text);
    assert.strictEqual(entities.length, 1);
    assert.strictEqual(entities[0].category, 'PASSWORD');
    assert.strictEqual(entities[0].rawValue, 'SuperSecretPassword123!');
  });

  test('detects Emails and Thai Phone numbers', () => {
    const text = 'Contact somchai@company.co.th or call 081-234-5678 for details.';
    const entities = scanDeterministic(text);
    assert.strictEqual(entities.length, 2);
    const categories = entities.map((e) => e.category);
    assert.ok(categories.includes('EMAIL'));
    assert.ok(categories.includes('PHONE'));
  });
});
