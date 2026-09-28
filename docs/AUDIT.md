# Audit

Snapshot of the repo's state. The first half is the Phase 0 baseline; the last sections record what changed and what is still open. Facts were checked against the code, not the old README.

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
| `POST /api/translate/details` | yes | definition, synonyms, antonyms, example, via the provider layer |
| `POST /api/translate/sentence` | yes | draft, verify and flag pipeline; result saved to History |
| `GET/PUT /api/users/profile` | yes | |
| `GET/POST/DELETE /api/history` | yes | |

There are no `/api/notes` or `/api/saved` routes. Prisma models: `User`, `History` only.

## Translation internals

- Languages: en, ar, fa, ur, tr. RTL: ar, fa, ur. Bengali is a UI language only.
- Dictionary lookups exclude rows with `pos` of `name` or `proper noun` (Wikidata-imported entity labels).
- Env names: `GROQ_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`. Groq model `openai/gpt-oss-120b` (Llama models were not available on the key). Gemini models are tried in order: `gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-2.5-flash`; all are listed as current with no shutdown date at https://ai.google.dev/gemini-api/docs/deprecations (2.5 models are noted as limiting access to users who have not used them).
- No LangChain. `zod` (validation) and `vitest` (with its `vite` peer dependency) are the only dependencies added.

## Dictionary

- `backend/src/lib/dictionary-db.ts` opens or creates `backend/data/dictionary.sqlite` on import (a side effect; tests mock the module). Table `dictionary(sourceWord, sourceLang, targetWord, targetLang, targetCode, pos)` with indexes on `(sourceWord, targetCode)` and `(targetWord, targetCode)`. About 228k rows, 40 MB.
- Built offline by `npm run import:*` from JSONL in `backend/src/scripts/data/` (Wiktionary extracts, about 4.2 GB in total) and `import:wikidata`. Both `data/` directories are gitignored.
- Wiktionary data is CC BY-SA; publishing the sqlite file needs attribution.

## Frontend

- React 18, Vite, Tailwind, `framer-motion`, axios, lucide-react. `zustand` is a dependency but nothing imports it.
- Working pages: Translate, Sentence, History, Settings. `NotesPage` calls `/api/notes` and `SavedLibraryPage` calls `/api/saved`; both routes are gone, so those pages return 404s. They are hidden from the nav but their routes and files remain.
- Sign-in is Google only. `RegisterPage` called a `register()` that never existed; it now redirects to `/login`.

## Tests and CI

- Backend: 71 Vitest unit tests, no network (LLM and dictionary mocked). Frontend: no tests, `type-check` and `build` only.
- `.github/workflows/ci.yml` runs on push and pull request: backend install, `better-sqlite3` load check, `prisma generate`, type-check, tests; frontend install, type-check, build. It has not been observed running on GitHub yet because nothing has been pushed.
- Both packages type-check with zero errors. Evaluation (`npm run eval`) is not part of CI.

## Open items and leftovers

Needs a decision before deleting:

- `frontend/config.js`: tracked, contains a hardcoded Firebase web config. Unused by the app.
- `frontend/firebase.js`: tracked, Node `firebase-admin` code that requires `./firebase.admin.json`. Does not belong in the frontend.
- `zustand` dependency (unused).
- `NotesPage`, `SavedLibraryPage` and `notesService.ts`: dead until Notes and Saved translations are rebuilt (Phase 10, not started).

Other:

- The Firebase web config was hardcoded in `frontend/src/lib/firebase.ts` until it moved to `VITE_FIREBASE_*`. It remains in the git history of the first commit (Firebase web keys are not secrets, but rotate or restrict the key if that matters to you).
- Deployment is deferred (Phase 8): Dockerfile, `docs/DEPLOY.md`, and how a deployed backend gets `dictionary.sqlite` (about 40 MB built; the 4 GB sources are not deployable) are undecided.
- Gemini free tier is frequently overloaded (503) or rate limited (429), and Groq's free tier limits tokens per minute. See `backend/eval/REPORT.md` for measured effects.
- The rate limiter is in-memory and single-instance.
- Phase 2c (cross-checking source words against dictionary translations) was skipped: the dictionary is a flat word-pair table with no inflection handling, so per-token matching against a free-text draft would be noisy.
- The glossary, and all three evaluation datasets, are AI-generated starter sets that need human review.
- No screenshot of the Review section is included: it sits behind Firebase login and was not captured.
