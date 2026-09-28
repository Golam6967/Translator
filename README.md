# Al-Maktaba (Acculator)

An Islamic-text translation companion for English, Arabic, Persian, Urdu and Turkish. Single words are answered from a local dictionary first and fall back to an LLM only when the dictionary has no entry. Sentences and passages go through a draft, verify and flag pipeline that reports how confident the review was, which terms are ambiguous, and whether standard Islamic terminology was rendered as expected.

Machine translation is not authoritative, especially for Quran and hadith text. The app says so when it detects scripture-like input.

## Features

- **Word lookup** across 5 languages: local SQLite dictionary (English is the pivot language), then Groq, then Gemini.
- **Word details**: definition, synonyms, antonyms and an example sentence, generated on request.
- **Sentence translation** (`/dashboard/sentence`): a draft step, then LLM verification and ambiguity flagging in parallel, plus a deterministic check of 58 common Islamic terms. Every result carries a plain-text review: verification status, issues, flagged terms, glossary warnings, and which provider answered.
- **Provider fallback**: Groq first, Gemini second, with a timeout, one retry on transient errors, and a user-safe error if both fail.
- **RTL rendering** for Arabic, Persian and Urdu; light and dark themes; English and Bengali interface language.
- **Google sign-in** through Firebase, and a per-user **history** of lookups and sentence translations.

Not implemented: notes, saved translations and text-to-speech (the backend routes for these were removed; the Notes and Saved pages exist in the frontend but are hidden from the navigation).

## Architecture

```mermaid
flowchart TD
    U[Browser: React + Vite] -->|Firebase ID token| API[Express API]
    API --> AUTH[Firebase Admin: verify token]
    API --> W[POST /translate/word]
    API --> S[POST /translate/sentence]

    W --> D[(SQLite dictionary)]
    D -->|hit| R1[Result: source = dictionary]
    D -->|miss| LLM[LLM provider layer]

    S --> P1[1. Draft]
    P1 --> P2[2a. Verify - LLM]
    P1 --> P3[3. Flag - LLM]
    P2 --> G[2b. Glossary check - no LLM]
    P3 --> G
    G --> R2[Result + review + metadata]
    R2 --> H[(PostgreSQL: History)]

    P1 & P2 & P3 & LLM --> PL

    subgraph PL[Provider layer]
        direction LR
        GQ[Groq] -->|error / timeout / retry once| GM[Gemini models, tried in order]
    end
```

## Project structure

```
backend/   Express + TypeScript API, Prisma (PostgreSQL), SQLite dictionary, LLM layer
  src/llm/           provider adapters and retry/fallback (callWithMeta)
  src/translation/   sentence pipeline, prompts, zod schemas, glossary
  src/services/      dictionary lookups and word details
  eval/              evaluation datasets, runner and generated report
frontend/  React 18 + Vite + Tailwind
docker-compose.yml   local PostgreSQL
docs/AUDIT.md        notes on the repo's state and open decisions
```

## Setup

Prerequisites: Node 24 (`.nvmrc`), Docker, a Firebase project (Google sign-in enabled), and a Groq API key. A Gemini API key is optional but enables the fallback.

```bash
# 1. Database
docker compose up -d            # PostgreSQL 16 on localhost:5432

# 2. Backend
cd backend
cp .env.example .env            # then fill in the values (see below)
npm install --legacy-peer-deps
npx prisma migrate deploy       # first run on a new database; use `npx prisma migrate dev` while developing
npm run dev                     # http://localhost:5000

# 3. Frontend (second terminal)
cd frontend
cp .env.example .env.local      # then fill in the Firebase web config
npm install --legacy-peer-deps
npm run dev                     # http://localhost:3000
```

If you switch Node versions, run `npm rebuild better-sqlite3` in `backend/` (it is a native module).

### The dictionary

`backend/data/dictionary.sqlite` is created empty on first run and is **not** in the repository. It is built from Wiktionary extracts (JSONL, about 4 GB, gitignored) placed in `backend/src/scripts/data/`:

```bash
cd backend
npm run import:dictionary       # arguments: arabic | persian | urdu | turkish | all
npm run import:wikidata         # optional: named entities
```

Without a dictionary, every word lookup goes to the LLM. Wiktionary data is CC BY-SA.

### Environment variables

Backend (`backend/.env`):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL URL, e.g. `postgresql://acculator:acculator@localhost:5432/acculator` |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | yes | Firebase Admin service account, as raw JSON |
| `GROQ_API_KEY` | yes | Primary LLM provider |
| `GOOGLE_GENERATIVE_AI_API_KEY` | no | Gemini fallback (skipped if unset) |
| `GROQ_MODEL` | no | Default `openai/gpt-oss-120b` |
| `GEMINI_MODEL` | no | Comma-separated, tried in order. Default `gemini-3.8-flash,gemini-3.5-flash,gemini-2.5-flash` |
| `LLM_PRIMARY_PROVIDER` | no | `groq` (default) or `gemini` |
| `LLM_TIMEOUT_MS` | no | Per-request timeout, default `20000` |
| `LLM_FORCE_FAIL_PRIMARY` | no | Testing only: force the fallback path. Ignored when `NODE_ENV=production` |
| `PORT` | no | Default `5000` |

Frontend (`frontend/.env.local`): `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, and `VITE_API_BASE_URL` (default `http://localhost:5000`).

## API

All routes except `/health` and `/api/translate/languages` require `Authorization: Bearer <Firebase ID token>`.

| Route | Purpose |
|---|---|
| `GET /health` | Health check |
| `POST /api/auth/verify-token`, `GET /api/auth/me` | Token verification and current user |
| `GET /api/translate/languages` | Supported languages and dictionary coverage |
| `POST /api/translate/word` | `{ word, fromLang, toLang }` returns `results[]` and `source` (`dictionary`, `groq` or `gemini`) |
| `POST /api/translate/details` | `{ word, lang, fields }` returns definition, synonyms, antonyms, example |
| `POST /api/translate/sentence` | `{ text, sourceLang, targetLang }` (max 2000 characters) returns the translation and review |
| `GET/PUT /api/users/profile` | User preferences |
| `GET/POST/DELETE /api/history` | Activity history |

Limits: translate routes are rate limited per user (60 requests per minute for word and details, 10 per minute for sentences) and request bodies are capped at 100 KB.

## Tests and evaluation

```bash
cd backend
npm run type-check
npm test                          # unit tests; the LLM and dictionary are mocked, no network
npm run eval                      # writes eval/REPORT.md (real API calls)
npm run eval -- --force-fallback  # fallback reliability, forces the primary provider to fail
```

CI (GitHub Actions) type-checks and runs the unit tests for both packages and builds the frontend on every push and pull request. The evaluation is not part of CI because it calls real APIs.

## Design decisions

- **Dictionary first.** Most single-word lookups do not need an LLM. A local lookup is instant, free, deterministic and works offline; the LLM is reserved for misses and for names. Rows imported from Wikidata as names or proper nouns are excluded from lookups, because they matched entity labels (for example returning a person's full name for a given name).
- **Three steps for sentences.** Drafting and reviewing are separate calls so the reviewer sees the source and the draft independently. Verify and flag run in parallel because both need only the draft, which keeps latency close to two calls. A suggested revision is adopted only at medium or high reviewer confidence, and the original draft is always returned, so the source text is never silently rewritten.
- **A deterministic glossary check beside the LLM check.** The glossary check is plain code: fast, free, testable, and it cannot hallucinate. It catches the case where the LLM verifier approves a draft that renders a standard term unusually. Its 58 entries are a starter set and need human review.
- **Fallback with limits.** A slow or rate-limited provider should not fail the request. The primary gets one retry on transient errors, then the fallback gets one attempt. Nothing is logged that contains user text or keys, and clients never see provider errors.
- **Structured outputs with a safety net.** Every LLM response for the pipeline is validated with zod. Invalid output triggers one retry with a reminder; if it is still invalid, verification is marked skipped instead of failing the request.

## Known limitations

- Machine translation is not authoritative. The review is advisory, and the evaluation datasets have no human-checked reference translations.
- The rate limiter is in-memory: it resets on restart and does not work across multiple instances.
- Gemini's free tier is frequently overloaded and allows only 20 requests per model per day, so the fallback is effectively unusable on a free key (see the results below).
- Glossary matching is word-level; short Turkish suffix matching can rarely give a false match.
- Sign-in is Google only.

## Evaluation results

Measured on 2026-09-28 with `npm run eval` (full detail and raw results in [`backend/eval/REPORT.md`](backend/eval/REPORT.md)). Groq `openai/gpt-oss-120b`; Gemini `gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-2.5-flash`. The datasets are small AI-generated starter sets with no human-checked reference translations, so these numbers describe pipeline behaviour, not translation quality.

| Metric | Result |
|---|---|
| Verify and flag calls returning valid JSON on the first try | 100.0% (60/60) |
| Glossary terms whose accepted rendering appeared in the final translation | 90.7% (39/43) |
| Deliberately corrupted drafts where verification reported an issue | 100.0% (8/8) |
| False positives on correct control drafts | 0.0% (0/3) |
| Sentence requests that succeeded (30 cases, 12 s between cases) | 100.0% (30/30) |
| Sentence latency, total (median / p95) | 3.27 s / 4.77 s |
| Step latency, median (draft / verify / flag) | 0.69 s / 0.74 s / 2.34 s |
| Reviewer revisions adopted | 3.3% (1/30) |
| Scripture notice shown | 26.7% (8/30) |
| Words answered by the dictionary / by the LLM fallback (46 words) | 69.6% (32) / 30.4% (14) |
| Word latency, median: dictionary / LLM fallback | 0.00 s / 0.76 s |

The 8 name lookups (Musab, Yusuf and so on) all went to the LLM, since name rows are excluded from dictionary lookups.

**Fallback reliability was not measured reliably.** Two forced-failure runs of 15 sentences succeeded 6 of 15 times and then 0 of 15 times. Both were limited by Gemini's free tier, not by the mechanism: a 429 from this key reported a limit of 20 requests per model per day, and a sentence uses 3 calls, so the run after the quota was used up got no answers. The fallback path is covered by unit tests and manual forced-failure calls that Gemini answered, but a real reliability figure needs a key with real quota.

**Pace matters on free tiers.** An earlier run with 2.5 s between cases had 13.3% (4/30) of sentence requests fail outright and 23.1% (18/78) of steps get no provider answer because of rate limits. The table above is from the slower run.


## License

ISC
