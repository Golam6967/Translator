# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Acculator (Al-Maktaba) is an Islamic translation companion app: a React/Vite frontend under `frontend/` and an Express/TypeScript backend under `backend/`, using Firebase (auth), PostgreSQL in Docker via Prisma (users and activity history), and a local SQLite dictionary via `better-sqlite3` (translation).

Translation is **dictionary-first, with LLM fallback**. Word lookups hit the local SQLite dictionary, then Groq, then Gemini (raw `fetch` calls in `backend/src/services/translationService.ts`; there is no LangChain). The earlier LangChain/Groq pipeline, notes and saved-translation routes, and the Python speech pipeline were removed. `backend/prisma/schema.prisma` has only `User` and `History`.

What's wired up in `backend/src/app.ts`: `/health`, `/api/auth/*`, `/api/translate/*`, `/api/users/*` (profile), `/api/history/*`. `/api/translate/sentence` is a 501 stub. `NotesPage` and `SavedLibraryPage` in the frontend still call `/api/notes` and `/api/saved`, which do not exist, so those pages fail with 404s. Don't assume a route, model, or dependency from the root `README.md` exists until you check the actual file; the README is being rewritten.

The repo root contains only `frontend/`, `backend/`, `docker-compose.yml`, and config/docs. The old root-level Next.js scaffold and Vercel docs were deleted and should not be restored.

## Commands

Node is pinned to 24 (`.nvmrc`, `engines`). `better-sqlite3` is a native module: after switching Node versions run `npm rebuild better-sqlite3` in `backend/`.

### Database (repo root)
```bash
docker compose up -d      # Postgres 16 on localhost:5432 (user/password/db: acculator)
```

### Backend (`backend/`)
```bash
npm run dev              # tsx watch --env-file=.env src/index.ts, serves on PORT (default 5000)
npm run build             # tsc -> dist/
npm start                 # node dist/index.js
npm run prisma:migrate    # prisma migrate dev (use `npx prisma migrate deploy` to only apply)
npm run prisma:studio     # prisma studio
npm run import:dictionary # tsx src/scripts/importDictionary.ts (args: arabic|persian|urdu|turkish|all)
npm run import:wikidata   # tsx src/scripts/importWikidata.ts
npm run test:dictionary   # tsx src/scripts/testDictionary.ts
```
No test runner or lint script is configured yet; `test:dictionary` is a standalone script. `npx tsc --noEmit` reports one pre-existing error (missing `@types/cors`).

### Frontend (`frontend/`)
```bash
npm run dev          # vite, serves on 3000 (falls back to next free port)
npm run build         # vite build
npm run preview       # vite preview
npm run type-check    # tsc --noEmit
```
No test runner is configured. `npm run type-check` reports pre-existing errors unrelated to any given change (unused `React` imports, `ImportMeta.env` typing, a stale `register` reference in `RegisterPage.tsx`); check the specific error before assuming your edit broke something.

Both packages install with `npm install --legacy-peer-deps`.

## Environment

- Backend `.env`: `DATABASE_URL` (local Docker Postgres, `postgresql://acculator:acculator@localhost:5432/acculator`), `FIREBASE_SERVICE_ACCOUNT_KEY` (raw JSON), `GROQ_API_KEY`, `PORT`. Optional: `GOOGLE_GENERATIVE_AI_API_KEY` (Gemini fallback; skipped if unset), `GROQ_MODEL` (default `openai/gpt-oss-120b`), `GEMINI_MODEL` (default `gemini-2.5-flash`). Loaded via `--env-file=.env` in the dev script.
- The dictionary is a local file, not env-configured: `backend/src/lib/dictionary-db.ts` opens/creates `backend/data/dictionary.sqlite` on import, populated via the `import:*` scripts from JSONL sources in `backend/src/scripts/data/`. Both `data/` directories are gitignored (the JSONL sources are about 4 GB).
- Frontend needs `VITE_FIREBASE_*` keys and `VITE_API_BASE_URL` (defaults to `http://localhost:5000`), read in `frontend/src/lib/firebase.ts` / `lib/api.ts`.
- Both `.env` files are gitignored; `.env.example` in each package documents the shape.

## Architecture

### Auth flow
1. Frontend signs in with the Firebase client SDK (`frontend/src/lib/firebase.ts`, `contexts/AuthContext.tsx`), storing the ID token in `localStorage` under `firebaseToken`.
2. `frontend/src/lib/api.ts` is a shared axios instance: a request interceptor attaches `Authorization: Bearer <token>`, a response interceptor clears the token and redirects to `/login` on any 401.
3. `backend/src/middleware/auth.ts` (`verifyFirebaseToken`, exported as `requireAuth`) verifies the token via `firebase-admin`, then looks up (or lazily creates) the Prisma `User` row keyed by `firebaseUid`, setting `req.userId` / `req.firebaseUid`. It gates `/api/translate/word`, `/details`, `/sentence`, `/api/users/*` and `/api/history/*` (but not `/api/translate/languages`).
4. `backend/src/lib/firebase.ts` parses `FIREBASE_SERVICE_ACCOUNT_KEY` at import time and initializes `firebase-admin` as a side effect; it must be imported before routes. If the env var is missing it logs a warning instead of throwing.
5. Errors thrown as `ApiError` (`middleware/errorHandler.ts`) carry a `statusCode`; anything else becomes a generic 500.

### Translation flow
- `dictionary-db.ts` owns one `better-sqlite3` connection with a flat `dictionary(sourceWord, sourceLang, targetWord, targetLang, targetCode, pos)` table.
- `services/translationService.ts` hardcodes 5 languages (`en`, `ar`, `fa`, `ur`, `tr`). English is the pivot: `en -> X` and `X -> en` are direct lookups; `X -> Y` bridges through English. Rows with `pos` of `name` or `proper noun` (imported from Wikidata) are excluded from lookups so names go to the LLM instead of matching entity labels.
- On a dictionary miss, `translateWord` tries Groq, then Gemini, and returns `null` (mapped to a 404) if both fail. Results carry `source: "dictionary" | "groq" | "gemini"`.
- `routes/translate.ts`: `GET /languages` (public), `POST /word`, `POST /details` (definition, synonyms, antonyms, example for a word via Groq; body `{word, lang, fields}`), `POST /sentence` (501 stub).
- Frontend `pages/TranslatePage.tsx`: a controls card (source `Dropdown`, output-language `MultiDropdown`, "Show in results" `MultiDropdown`), an input card with an optional on-screen keyboard, and per-language result cards. It calls `/word` once per output language in parallel, then `/details` for the source word and each first translation when detail fields are selected. Language metadata lives in `frontend/src/lib/languages.ts`, separate from the backend list; keep both in sync when adding a language.

### Frontend routing/state
- `App.tsx` wraps everything in `ThemeProvider` > `LanguageProvider` > `AuthProvider`, then `BrowserRouter`. `/login`, `/register`, `/auth-callback` are public; the rest go through `ProtectedRoute` into `DashboardLayout` (Translate, Notes, Saved Library, History, Settings). Only Translate, History and Settings have live backend support.
- `LanguageContext` handles English/Bengali UI language (Bengali is UI only, not a translation language), `ThemeContext` handles light/dark.
- `components/ui/` holds the local component kit (`Button`, `Card`, `Dropdown`/`MultiDropdown`, `LanguageBadge`, `VirtualKeyboard`, `Skeleton`, `ConfirmDialog`). `zustand` is listed as a dependency but unused.

### Data model
- Prisma models (`backend/prisma/schema.prisma`): `User` (keyed by `firebaseUid`/`googleId`/`email`, plus UI preference fields, table `users`) and `History` (`userId`, `type`, `data`, JSON `metadata`, table `history`). Dictionary data lives only in the SQLite file. Reintroducing Notes or SavedTranslation needs their models added back first.
