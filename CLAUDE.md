# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Al-Maktaba (package name Acculator) is an Islamic translation companion app: a React/Vite frontend under `frontend/` and an Express/TypeScript backend under `backend/`, using Firebase (Google sign-in), PostgreSQL in Docker via Prisma (users and activity history), and a local SQLite dictionary via `better-sqlite3`.

Translation is **dictionary-first, with LLM fallback**. Word lookups hit the SQLite dictionary, then Groq, then Gemini, through a provider layer in `backend/src/llm/` (raw `fetch`; there is no LangChain). Sentences go through a draft, verify and flag pipeline in `backend/src/translation/`. The earlier LangChain/Groq pipeline, notes and saved-translation routes, and the Python speech pipeline were removed. `backend/prisma/schema.prisma` has only `User` and `History`.

Wired up in `backend/src/app.ts`: `/health`, `/api/auth/*`, `/api/translate/*` (`languages`, `word`, `details`, `sentence`), `/api/users/*` (profile), `/api/history/*`. `NotesPage` and `SavedLibraryPage` still call `/api/notes` and `/api/saved`, which do not exist; they are hidden from the nav. Sign-in is Google only (`RegisterPage` just redirects to `/login`). The README describes the current app; `docs/AUDIT.md` records open decisions and leftovers.

## Commands

Node is pinned to 24 (`.nvmrc`, `engines`). `better-sqlite3` is a native module: after switching Node versions run `npm rebuild better-sqlite3` in `backend/`.

### Database (repo root)
```bash
docker compose up -d      # Postgres 16 on localhost:5432 (user/password/db: acculator)
```

### Backend (`backend/`)
```bash
npm run dev               # tsx watch --env-file=.env src/index.ts, serves on PORT (default 5000)
npm run build              # tsc -> dist/
npm start                  # node dist/index.js
npm run type-check         # tsc --noEmit (clean)
npm test                   # vitest run; LLM and dictionary are mocked, no network
npm run eval               # evaluation harness, real API calls, writes eval/REPORT.md
npm run eval -- --force-fallback --limit 15   # fallback reliability
npm run prisma:migrate     # prisma migrate dev (use `npx prisma migrate deploy` to only apply)
npm run prisma:studio
npm run import:dictionary  # args: arabic|persian|urdu|turkish|all
npm run import:wikidata
npm run test:dictionary    # standalone script, not part of vitest
```
Avoid running `grep -r` over `backend/src/scripts/data/` (about 4 GB of JSONL).

### Frontend (`frontend/`)
```bash
npm run dev          # vite, serves on 3000 (falls back to next free port)
npm run build         # vite build
npm run type-check    # tsc --noEmit (clean)
```
Both packages install with `npm install --legacy-peer-deps`. CI (`.github/workflows/ci.yml`) runs type-check and tests for the backend, and type-check and build for the frontend.

## Environment

- Backend `.env`: `DATABASE_URL` (`postgresql://acculator:acculator@localhost:5432/acculator`), `FIREBASE_SERVICE_ACCOUNT_KEY` (raw JSON), `GROQ_API_KEY`, `PORT`. Optional: `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini fallback; skipped if unset), `GROQ_MODEL` (default `openai/gpt-oss-120b`), `GEMINI_MODEL` (comma-separated, tried in order; default `gemini-3.8-flash,gemini-3.5-flash,gemini-2.5-flash`), `LLM_PRIMARY_PROVIDER`, `LLM_TIMEOUT_MS`, `LLM_FORCE_FAIL_PRIMARY` (test only, ignored in production). Loaded via `--env-file=.env`.
- The dictionary is a local file, not env-configured: `backend/src/lib/dictionary-db.ts` opens/creates `backend/data/dictionary.sqlite` on import (a side effect; tests mock this module). It is populated by the `import:*` scripts from JSONL in `backend/src/scripts/data/`. Both `data/` directories are gitignored.
- Frontend `.env.local`: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_API_BASE_URL`. Read in `src/lib/firebase.ts` and `src/lib/api.ts`; restart `vite` after changing them.
- `.env` and `.env.local` are gitignored; `.env.example` in each package documents the shape.

## Architecture

### Auth flow
1. Frontend signs in with the Firebase client SDK (`contexts/AuthContext.tsx`), storing the ID token in `localStorage` under `firebaseToken`.
2. `frontend/src/lib/api.ts` is a shared axios instance: a request interceptor attaches `Authorization: Bearer <token>`, a response interceptor clears the token and redirects to `/login` on any 401.
3. `backend/src/middleware/auth.ts` (`requireAuth`) verifies the token via `firebase-admin`, then looks up or lazily creates the Prisma `User` keyed by `firebaseUid`, setting `req.userId` / `req.firebaseUid`. It gates every translate route except `/languages`, plus users and history.
4. `backend/src/lib/firebase.ts` parses `FIREBASE_SERVICE_ACCOUNT_KEY` at import time and initializes `firebase-admin` as a side effect; it must be imported before routes.
5. `ApiError` (`middleware/errorHandler.ts`) carries a `statusCode`; the handler also maps oversized bodies to 413 and malformed JSON to 400.

### Provider layer (`backend/src/llm/`)
- `providers.ts`: Groq and Gemini adapters (raw `fetch`, `AbortSignal.timeout`). Errors are `ProviderError` with a `transient` flag (429, 5xx, timeout, network). Gemini tries each model in `GEMINI_MODEL` order.
- `callWithMeta.ts`: `createLLMCaller(deps)` and the default `callLLM`. The primary gets one retry on transient errors, then the secondary gets one attempt. Returns `{ output, provider, attempts, fallbackUsed, latencyMs }`, logs JSON lines without prompts or keys, and throws `ApiError(503)` with a user-safe message when both fail. `deps` is injectable for tests.

### Translation
- `services/translationService.ts`: 5 languages (`en`, `ar`, `fa`, `ur`, `tr`); English is the pivot for `X -> Y`. Rows with `pos` of `name` or `proper noun` (Wikidata imports) are excluded from lookups. A miss goes to `callLLM`; results carry `source: "dictionary" | "groq" | "gemini"`. `getWordDetails` returns definition, synonyms, antonyms, example through the same layer.
- `translation/pipeline.ts`: `translateSentence` runs draft, then verify and flag in parallel. Every LLM reply is validated with zod (`schemas.ts`); invalid output gets one retry with a reminder, then the step is skipped (verify and flag) or the request fails with 502 (draft). A `suggestedRevision` is adopted only at medium or high confidence and the original draft is returned. `glossary.ts` plus `glossary.json` (58 starter terms, needs human review) does the deterministic check with no network. `history.ts` saves results to `History.metadata` as type `translate_sentence`. `verifyDraft` exists for the evaluation harness. `callLLM` is injectable for tests.
- `routes/translate.ts`: zod validation on every route; `middleware/rateLimit.ts` is an in-memory per-user limiter (60/min for word and details, 10/min for sentences; resets on restart, single instance only). JSON bodies are capped at 100 KB.
- `eval/`: `sentences.json`, `corrupted.json`, `words.json` (starter sets), `run.ts`, generated `REPORT.md` and raw `results/*.json`. Numbers in the README must come from this report.

### Frontend
- `App.tsx` wraps everything in `ThemeProvider` > `LanguageProvider` > `AuthProvider`, then `BrowserRouter`. `/login`, `/register` (redirect), `/auth-callback` are public; the rest go through `ProtectedRoute` into `DashboardLayout` (Translate, Sentence, History, Settings in the nav; Notes and Saved routes exist but are hidden and broken).
- `pages/TranslatePage.tsx`: controls card (`Dropdown`, `MultiDropdown`), input card with optional on-screen keyboard, per-language result cards; calls `/word` once per output language, then `/details`. `pages/SentencePage.tsx`: native selects and a plain-text Review section, deliberately with no animation.
- Language metadata lives in `lib/languages.ts`, separate from the backend list; keep both in sync. `LanguageContext` is English/Bengali UI language only. `zustand` is a dependency but unused.

### Data model
- `User` (keyed by `firebaseUid`/`googleId`/`email`, plus UI preference fields, table `users`) and `History` (`userId`, `type`, `data`, JSON `metadata`, table `history`). Dictionary data lives only in SQLite. Reintroducing Notes or SavedTranslation needs their models added back first.
