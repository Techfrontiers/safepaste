# SafePaste AI — Your Private Gateway to AI

![License](https://img.shields.io/badge/License-Apache_2.0-emerald.svg)
![Hackathon](https://img.shields.io/badge/Google_Firebase-%23BuildHybridAI_2026-blue.svg)
![Tests](https://img.shields.io/badge/Core_Tests-13%2F13_Passing-brightgreen.svg)

> **"AI can be intelligent without trading away your secrets."**  
> Built for **Google Firebase #BuildHybridAI 2026** (Web / Chrome Extension Track).

---

## The Problem

Knowledge workers, developers, and consumers copy-paste confidential text into Cloud AI assistants every day — accidentally exposing:
- **Credentials & API Keys:** Google Cloud (`AIza...`), OpenAI (`sk-proj-...`), GitHub PATs (`ghp_...`), AWS Access Keys, Stripe keys, JWTs, and database passwords.
- **Regulated PII:** Thai National Citizen IDs (13 digits with check-digit validation), Luhn-valid credit cards, email addresses, and phone numbers.
- **Contextual Business Secrets:** Client names, M&A figures (`15,400,000 บาท`), and internal code names (`Project Pegasus`).

---

## 4-Stage Zero-Leakage Hybrid Architecture

SafePaste AI enforces a strict architectural security boundary powered by **Chrome Built-in AI (Gemini Nano)** and the **Firebase AI Logic Hybrid Inference SDK (`firebase/ai`)**:

1. **Stage 1 — 100% On-Device Privacy Scan (`ONLY_ON_DEVICE`):**
   - Runs **Deterministic Regex + Checksum Validators** (Luhn & Thai ID check-digit) combined with **Gemini Nano Prompt API** (`window.LanguageModel` / `window.ai.languageModel`, with an offline heuristic fallback) entirely inside the browser.
   - Raw input **never** crosses into cloud inference.
2. **Stage 2 — Invariant Two-Way Tokenization (`[[SP_*]]`):**
   - Replaces sensitive values with LLM-resilient tokens (e.g., `[[SP_API_KEY_01]]`, `[[SP_ORGANIZATION_01]]`, `[[SP_MONEY_01]]`, `[[SP_PERSON_01]]`).
   - Preserves semantic identity (identical values share the same token) and stores the ephemeral lookup vault strictly in local browser memory.
3. **Stage 3 — Hybrid AI Workspace (`PREFER_ON_DEVICE` / `ONLY_ON_DEVICE` / `ONLY_IN_CLOUD`):**
   - Runs a pre-flight **Zero-Leakage Firewall (`verifyZeroLeakage`)** to abort if any raw secret remains in the outbound payload.
   - Dispatches sanitized text via **`firebase/ai`** (`getAI`, `getGenerativeModel`, `GoogleAIBackend`, `InferenceMode`) protected by **Firebase App Check** and **Firebase Remote Config** (`gemini-2.5-flash` default).
   - Inspects `response.inferenceSource` dynamically to report true On-Device vs In-Cloud execution.
4. **Stage 4 — Safe Local Response Rehydration:**
   - Restores original secrets back into the AI response on the user's machine with fuzzy recovery for minor token formatting variations and missing-token auditing.

---

## Monorepo Structure

```text
safepaste/
├── packages/
│   └── core/               # @safepaste/core — Deterministic & Semantic detectors, Tokenizer, Rehydrator
├── apps/
│   ├── web/                # @safepaste/web — React + Vite + Tailwind Workspace & Network Inspector
│   └── extension/          # Chrome Manifest V3 Side Panel + ChatGPT/Claude/Gemini content script
└── scripts/
    └── build-extension.mjs # Packages web bundle + MV3 scripts into apps/extension/dist
```

---

## Quick Start

### Prerequisites
- **Node.js** `>= 18` (verified with Node v24)
- **Google Chrome** Desktop (for Chrome Extension & Gemini Nano Prompt API)

### 1. Install & Run Core Unit Tests
```bash
npm install
npm test
```
Verifies **13/13 tests across 3 suites** (`deterministic.test.js`, `tokenizer_rehydration.test.js`, `engine.test.js`).

### 2. Launch Web App Workspace Locally
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### 3. Build & Load the Chrome Extension (Manifest V3)
```bash
npm run build:extension
```
1. Open Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select `apps/extension/dist`.
4. Click the SafePaste icon to open the **Side Panel**, or select/paste text on ChatGPT, Claude, or Gemini Web to trigger the floating `SafePaste` shield button.

### 4. Connect Firebase AI Logic & Gemini Nano
- Click **Settings** in the SafePaste UI to enter your Firebase `apiKey`, `projectId`, `appId`, and **App Check** settings (Debug Token mode supported out of the box for `localhost` and `chrome-extension://` origins).
- To enable on-device Gemini Nano on Chrome Desktop, enable:
  - `chrome://flags/#prompt-api-for-gemini-nano`
  - `chrome://flags/#optimization-guide-on-device-model`

---

## License

Licensed under the **Apache License 2.0**. See [LICENSE](LICENSE) for full details.
