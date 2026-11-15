import { DetectedEntity, SensitiveCategory } from '../types/index.js';

interface RegexPatternRule {
  category: SensitiveCategory;
  pattern: RegExp;
  confidence: number;
  validator?: (match: string) => boolean;
}

/**
 * Validates a Thai National ID using the official check-digit algorithm
 */
export function validateThaiCitizenId(id: string): boolean {
  const cleanId = id.replace(/[-\s]/g, '');
  if (!/^\d{13}$/.test(cleanId)) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(cleanId[i], 10) * (13 - i);
  }
  const checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseInt(cleanId[12], 10);
}

/**
 * Validates credit card using Luhn algorithm
 */
export function validateLuhn(cardNumber: string): boolean {
  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = parseInt(digits.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

export const DETERMINISTIC_RULES: RegexPatternRule[] = [
  // 1. Google Gemini / Cloud API Key
  {
    category: 'API_KEY',
    pattern: /\bAIza[0-9A-Za-z-_]{35,45}\b/g,
    confidence: 1.0,
  },
  // 2. OpenAI API Keys (legacy & modern sk-proj-)
  {
    category: 'API_KEY',
    pattern: /\bsk-(?:proj-)?[a-zA-Z0-9_-]{32,80}\b/g,
    confidence: 0.98,
  },
  // 3. GitHub Personal Access Tokens
  {
    category: 'API_KEY',
    pattern: /\b(?:ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{82})\b/g,
    confidence: 1.0,
  },
  // 4. AWS Access Key ID
  {
    category: 'API_KEY',
    pattern: /\bAKIA[0-9A-Z]{16}\b/g,
    confidence: 0.95,
  },
  // 5. Stripe API Keys (Secret or Publishable)
  {
    category: 'API_KEY',
    pattern: /\b(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}\b/g,
    confidence: 0.99,
  },
  // 6. JWT Tokens
  {
    category: 'API_KEY',
    pattern: /\beyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g,
    confidence: 0.95,
  },
  // 7. Password in assignment patterns (e.g. password: "xyz", secret = 'abc')
  {
    category: 'PASSWORD',
    pattern: /(?:(?:password|passwd|pwd|secret|auth_token)\s*[:=]\s*["']?)([^\s"';,]+)(?:["']?)/gi,
    confidence: 0.9,
  },
  // 8. Email Addresses
  {
    category: 'EMAIL',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    confidence: 0.99,
  },
  // 9. Phone Numbers (International, Thai 08x/09x/06x, US standard)
  {
    category: 'PHONE',
    pattern: /(?:\+?66|0)[689]\d{1}[-\s]?\d{3}[-\s]?\d{4}\b|\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-\s]?\d{4}\b/g,
    confidence: 0.88,
  },
  // 10. Credit Card Numbers (checked via Luhn)
  {
    category: 'CREDIT_CARD',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{15,16}\b/g,
    confidence: 0.95,
    validator: validateLuhn,
  },
  // 11. Thai Citizen National ID (13 digits)
  {
    category: 'NATIONAL_ID',
    pattern: /\b\d{1}[-\s]?\d{4}[-\s]?\d{5}[-\s]?\d{2}[-\s]?\d{1}\b/g,
    confidence: 0.95,
    validator: validateThaiCitizenId,
  },
  // 12. IPv4 Addresses
  {
    category: 'IP_ADDRESS',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    confidence: 0.85,
  },
];

/**
 * Scans a text using deterministic rules with zero false-collision deduplication.
 */
export function scanDeterministic(text: string): DetectedEntity[] {
  const entities: DetectedEntity[] = [];
  let entityCounter = 1;

  for (const rule of DETERMINISTIC_RULES) {
    // Reset regex index for global matches
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = rule.pattern.exec(text)) !== null) {
      // If regex has a capture group (like passwords), target group 1, otherwise group 0
      const rawValue = match[1] || match[0];
      const matchIndex = match.index + (match[1] ? match[0].indexOf(match[1]) : 0);
      const endIndex = matchIndex + rawValue.length;

      // Run optional checksum validator (e.g., Luhn or Thai ID)
      if (rule.validator && !rule.validator(rawValue)) {
        continue;
      }

      // Check for overlapping matches with already detected entities
      const overlaps = entities.some(
        (existing) =>
          (matchIndex >= existing.startIndex && matchIndex < existing.endIndex) ||
          (endIndex > existing.startIndex && endIndex <= existing.endIndex) ||
          (matchIndex <= existing.startIndex && endIndex >= existing.endIndex)
      );

      if (!overlaps) {
        entities.push({
          id: `det_${rule.category.toLowerCase()}_${entityCounter++}`,
          category: rule.category,
          rawValue,
          startIndex: matchIndex,
          endIndex,
          method: 'DETERMINISTIC_REGEX',
          confidence: rule.confidence,
        });
      }
    }
  }

  // Sort entities by starting index ascending
  return entities.sort((a, b) => a.startIndex - b.startIndex);
}
