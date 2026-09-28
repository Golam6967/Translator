# Deploying Al-Maktaba

Backend on Railway, frontend on Vercel, database on Railway PostgreSQL. Deploy the backend first, since the frontend needs its URL.

Before you start: create fresh `GROQ_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` and Firebase service-account keys if the ones on your machine were ever pasted anywhere outside your own `.env` file.

## 1. Backend + database on Railway

1. **New Project → Deploy from GitHub repo**, select this repo. Railway creates one service from the repo root; open its **Settings → Source** and set **Root Directory** to `backend`.
2. **Add a database:** in the project, **New → Database → Add PostgreSQL**.
3. In the backend service's **Variables**, set:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres service) |
   | `FIREBASE_SERVICE_ACCOUNT_KEY` | the service-account JSON, on one line |
   | `GROQ_API_KEY` | your Groq key |
   | `GOOGLE_GENERATIVE_AI_API_KEY` | optional (Gemini fallback) |
   | `NODE_ENV` | `production` |

   Do not set `PORT` — Railway injects it, and `backend/src/index.ts` already reads `process.env.PORT`.
4. Railway reads `backend/railway.toml` automatically:
   - **Build:** `npm ci --legacy-peer-deps && npx prisma generate && npm run build`
   - **Pre-deploy:** `npx prisma migrate deploy` (applies the committed migration to the Railway database; never `migrate dev` here)
   - **Start:** `npm start`
   - **Health check:** `GET /health`
5. Deploy. Once it's live, open **Settings → Networking → Generate Domain**. Visit `https://<your-app>.up.railway.app/health` and confirm it returns `{"status":"ok",...}`.

### The dictionary

`backend/data/dictionary.sqlite` (about 40 MB) is committed to the repo specifically so Railway has it — the file is explicitly un-ignored in `backend/.gitignore` and the root `.gitignore`. The raw Wiktionary JSONL sources it was built from (about 4 GB) stay out of git; nothing at deploy time needs them. Wiktionary data is CC BY-SA — the app's UI or docs should credit Wiktionary if you publish this deployment publicly.

If you ever regenerate the dictionary locally (`npm run import:dictionary` / `import:wikidata`), commit the updated `backend/data/dictionary.sqlite` the same way.

## 2. Frontend on Vercel

1. **Add New → Project**, import the repo. Set **Root Directory** to `frontend`. Vercel auto-detects Vite (install: `npm install --legacy-peer-deps`, build: `npm run build`, output: `dist`).
2. **Environment variables** (Project Settings → Environment Variables — these are baked in at build time, so re-deploy after changing any of them):

   | Variable | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | from your Firebase web app config |
   | `VITE_FIREBASE_AUTH_DOMAIN` | " |
   | `VITE_FIREBASE_PROJECT_ID` | " |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | " |
   | `VITE_FIREBASE_APP_ID` | " |
   | `VITE_API_BASE_URL` | your Railway backend URL, no trailing slash |

3. `frontend/vercel.json` rewrites all paths to `index.html`, which client-side routing (React Router) needs — without it, refreshing `/dashboard` 404s.
4. Deploy. In the **Firebase console → Authentication → Settings → Authorized domains**, add the Vercel domain (and any custom domain), or Google sign-in will fail with `auth/unauthorized-domain`.

## 3. Verify

Open the Vercel URL, sign in with Google, look up a word (dictionary and LLM-fallback paths), and translate a sentence (checks the full pipeline and Railway → Postgres write to History).

If something fails, check in this order: browser console/network tab for the failing request → Railway deploy logs → `GET /health` on the backend directly.

## Known gaps at this stage

- **CORS is open to all origins** (`cors()` with no options in `backend/src/app.ts`). Fine to start; restrict to the Vercel domain once it's stable.
- **Rate limiting is in-memory** and resets on every Railway redeploy; it also does not coordinate across multiple instances if you ever scale the service out.
- **No custom domain, CI deploy gating, or staging environment** are set up — this covers a single production deploy of each service.
