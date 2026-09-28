# Audit (Phase 0 baseline)

Snapshot of the repo at the start of the Al-Maktaba upgrade plan. Facts were checked against the code, not the old README.

## Runtime

- Node 24 (pinned in `.nvmrc` and `engines`). `better-sqlite3` is a native module and must be rebuilt (`npm rebuild better-sqlite3`) after changing Node versions; it broke once already (built for Node 22, run on 24).
- PostgreSQL 16 in Docker (`docker-compose.yml`, service `db`, `localhost:5432`). Prisma reads only `DATABASE_URL`.

## Backend routes (`backend/src/app.ts`)

| Route | Auth | Notes |
|---|---|---|
| `GET /health` | no | |
| `/api/auth/*` | mixed | Firebase token verification and user creation |
| `GET /api/translate/languages` | no | 5 languages with dictionary coverage flags |
| `POST /api/translate/word` | yes | dictionary, then Groq, then Gemini |
| `POST /api/translate/details` | yes | definition, synonyms, antonyms, example (Groq only, no Gemini fallback yet) |
| `POST /api/translate/sentence` | yes | 501 stub |
| `GET/PUT /api/users/profile` | yes | |
| `GET/POST/DELETE /api/history` | yes | |

There are no `/api/notes` or `/api/saved` routes. Prisma models: `User`, `History` only.

## Translation internals

- `backend/src/services/translationService.ts` holds the dictionary lookups and the raw-`fetch` Groq and Gemini fallbacks. Languages: en, ar, fa, ur, tr. RTL: ar, fa, ur. Bengali is a UI language only.
- Dictionary lookups exclude rows with `pos` of `name` or `proper noun` (Wikidata-imported entity labels).
- Env names: `GROQ_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`. Models: `openai/gpt-oss-120b` (Groq), `gemini-2.5-flash` (Gemini). Llama models were not available on the Groq key.
- No LangChain, zod, test runner, rate limiter or CI exists. Express JSON body limit is 50 MB (`app.ts`).

## Dictionary

- `backend/src/lib/dictionary-db.ts` opens or creates `backend/data/dictionary.sqlite` on import (a side effect; tests must mock or redirect it). Table `dictionary(sourceWord, sourceLang, targetWord, targetLang, targetCode, pos)` with indexes on `(sourceWord, targetCode)` and `(targetWord, targetCode)`. About 228k rows, 40 MB.
- Built offline by `npm run import:*` from JSONL in `backend/src/scripts/data/` (Wiktionary extracts, about 4.2 GB in total: `Dictionary.jsonl` 3.1 GB, plus Arabic, Persian, Turkish, Urdu) and `import:wikidata` (SPARQL). Both `data/` directories are gitignored.
- Wiktionary data is CC BY-SA; publishing the sqlite file needs attribution. Delivery to a deployed backend is deferred (see Deployment).

## Frontend

- React 18, Vite, Tailwind, `framer-motion`, axios, lucide-react. `zustand` is a dependency but nothing imports it.
- Working pages: Translate, History, Settings. `NotesPage` calls `/api/notes` and `SavedLibraryPage` calls `/api/saved`; both routes are gone, so these pages return 404s. Decision pending: hide them or mark them "coming soon".

## Leftovers (need a decision before deleting)

- `frontend/config.js`: tracked, contains a hardcoded Firebase web config. Unused by the app (the app uses `src/lib/firebase.ts`).
- `frontend/firebase.js`: tracked, Node/`firebase-admin` code that requires `./firebase.admin.json`. Does not belong in the frontend.
- Root `.env.example`: tracked, describes the removed Next.js app (`NEXT_PUBLIC_*`). Stale.
- `backend/.env.example` lists `LIBRETRANSLATE_URL` and `FIREBASE_PROJECT_ID`, which no code reads.
- `zustand` (see above).

## Tests and CI

None. `backend` has `test:dictionary` (a standalone script). `frontend` has `type-check`. Known pre-existing type errors: backend missing `@types/cors`; frontend unused `React` imports, `ImportMeta.env` typing, a stale `register` reference in `RegisterPage.tsx`.

## Decisions recorded

- Phase 2c (cross-check source words against dictionary translations): skipped for now. The dictionary is a flat word-pair table with no inflection handling, so per-token matching against a free-text draft would produce noisy mismatches. Revisit only if evaluation shows glossary and LLM verification miss clear errors.
- Deployment (Phase 8, including how the deployed backend gets the dictionary) is deferred until the project is feature complete.

## Cleanup done in Phase 0

- Removed the root Next.js scaffold, old Vercel and LLM-era docs, and the Python speech pipeline (already deleted in the working tree; committed).
- Removed Supabase references from `README.md` and `CLAUDE.md`, and the unused `DIRECT_URL`.
- Corrected `CLAUDE.md` (History route and model exist; Groq is in use; Docker Postgres).
