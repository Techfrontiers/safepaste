# SafePaste AI — Your Private Gateway to AI 🛡️

> Built for the **Google Firebase #BuildHybridAI 2026** Hackathon  
> Platform: Chrome Extension (Manifest V3 Side Panel) + Web App Workspace  
> License: Apache-2.0

---

## 💡 The Problem
Millions of users, developers, and knowledge workers copy-paste sensitive text into cloud AI tools (ChatGPT, Claude, Gemini) daily. This routinely leaks:
- API Keys, Bearer tokens, Passwords, and Environment Secrets
- Personal Identifiable Information (PII) like Citizen IDs, Phone numbers, and Emails
- Confidential corporate metrics, customer names, and internal project code names

## 🛡️ The Solution: SafePaste AI
SafePaste is a **Local-First Privacy Gateway** between you and Cloud AI.

1. **Stage 1 — 100% On-Device Scanning (`ONLY_ON_DEVICE`):**
   - **Deterministic Scanner:** High-precision regex detectors for API keys, passwords, credit cards, phones, and emails.
   - **Contextual Semantic Scanner (Gemini Nano):** Analyzes conversational text for unpatterned sensitive entities (e.g. secret project names, VIP client mentions, financial figures).
2. **Stage 2 — Two-Way Invariant Tokenization:**
   - Converts sensitive values into structured tokens (e.g. `[[SP_PERSON_01]]`, `[[SP_API_KEY_01]]`).
   - The original mapping dictionary stays strictly in the user's browser memory / IndexedDB. **Zero raw data ever leaves the device.**
3. **Stage 3 — Hybrid Cloud AI Reasoning (`PREFER_ON_DEVICE`):**
   - Sanitized text is sent via **Firebase AI Logic Hybrid Inference SDK**.
   - Cloud AI summarizes, rewrites, translates, or explains without ever seeing the real secrets.
4. **Stage 4 — Safe Response Rehydration:**
   - The client verifies response integrity and swaps the original secrets back into the AI response on the user's machine.

---

## 🏗️ Monorepo Structure

```text
safepaste/
├── packages/
│   └── core/         # Core privacy engine, regex detectors, tokenizer, rehydration
├── apps/
│   ├── web/          # Interactive Web App & Zero-Leakage Inspector (Vite + React)
│   └── extension/    # Chrome Extension Manifest V3 (Side Panel)
└── docs/             # Technical specs, architecture diagrams, devpost submission
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 18
- Google Chrome (Desktop)

### Installation
```bash
npm install
npm test
```
