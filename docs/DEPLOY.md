# Deploying Al-Maktaba

Backend on **Render** (free web service), database on **Neon** (free Postgres), frontend on **Vercel**. Deploy the database and backend first, since the frontend needs the backend's URL.

Before you start: if any API key or database password was ever pasted somewhere it could leak (a chat, a public gist, etc.), rotate it first.

## 1. Database on Neon

1. neon.com → sign up (no card needed) → create a project.
2. On the project dashboard, click **Connect** and copy the connection string (`postgresql://user:pass@ep-xxxx.neon.tech/dbname?sslmode=require...`). This is your `DATABASE_URL`.
3. Create the tables. Render's **free** plan has no Shell access, so run the migration from your own machine instead — Neon is reachable from anywhere:
   ```bash
   cd backend
   # put the Neon connection string in DATABASE_URL for just this one command
   DATABASE_URL="<paste-the-neon-string>" npx prisma migrate deploy
   ```
   (On Windows PowerShell: `$env:DATABASE_URL="<string>"; npx prisma migrate deploy`.) You should see `All migrations have been successfully applied.` **Skipping this step is the single most common failure** — every request that touches the database will crash with `The table 'public.users' does not exist` until this has run.

## 2. Backend on Render

1. Render dashboard → **New → Web Service** → connect GitHub → select this repo.
2. **Settings → Build & Deploy → Root Directory**: set to `backend`.
3. Fill in:
   - **Runtime**: Node
   - **Build Command**: `npm ci --legacy-peer-deps && npx prisma generate && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
4. **Advanced → Health Check Path**: `/health`
5. **Advanced → Environment Variables**:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Neon connection string from step 1 |
   | `FIREBASE_SERVICE_ACCOUNT_KEY` | service-account JSON, one line |
   | `GROQ_API_KEY` | your Groq key |
   | `GOOGLE_GENERATIVE_AI_API_KEY` | optional (Gemini fallback) |
   | `NODE_ENV` | `production` |

   Do not set `PORT` — Render injects it, and `backend/src/index.ts` reads `process.env.PORT`.
6. **Create Web Service.**
7. Once live, confirm `https://<your-service>.onrender.com/health` returns `{"status":"ok",...}`. First request after idle can take up to a minute (free-tier cold start — the box in the Render dashboard warns about this).

`render.yaml` at the repo root mirrors these build/start/health-check settings as code (Render's "Blueprint" format). It only takes effect if you create the service *from* the blueprint (New → Blueprint) rather than manually; on an already-existing manually-created service it's just a reference for what the dashboard fields should say.

### Two real gotchas we hit, both caused by `NODE_ENV=production`

Render sets `NODE_ENV=production`, and current npm (v9–v11) defaults to `omit=dev` whenever that's set — meaning `npm ci` **silently skips everything in `devDependencies`**.

- `prisma`, `typescript`, and the `@types/*` packages needed to compile the backend must live in `dependencies`, not `devDependencies`, or the build either can't run Prisma commands at all, or `tsc` fails with missing type declarations. This is already fixed in `backend/package.json` — if you ever move a build-time tool back into `devDependencies`, this will resurface.
- If a build log shows `yarn install` running instead of the command from step 3 above, the custom Build Command setting didn't actually save (this happened once, cause unclear — possibly a UI issue when editing Root Directory). Go back to **Settings → Build & Deploy**, re-type the Build Command exactly, and click **Save Changes** before redeploying.

If a deploy "succeeds" but `npm start` then fails with `Cannot find module '.../dist/index.js'`, the build never actually ran (see the `yarn install` gotcha above) — check **Manual Deploy → Deploy latest commit** actually triggered a fresh build, not just a restart of the existing (broken) instance. Editing an environment variable restarts the service; it does not rebuild it.

## 3. Frontend on Vercel

1. **Add New → Project** → import the repo → **Root Directory**: `frontend` (Vercel should auto-detect Vite).
2. **Environment Variables** (baked in at build time — redeploy after changing any of these):

   | Key | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | from your Firebase web app config |
   | `VITE_FIREBASE_AUTH_DOMAIN` | " |
   | `VITE_FIREBASE_PROJECT_ID` | " |
   | `VITE_FIREBASE_MESSAGING_SENDER_ID` | " |
   | `VITE_FIREBASE_APP_ID` | " |
   | `VITE_API_BASE_URL` | your Render backend URL, no trailing slash |

   These are all public values baked into client-side JS regardless of Vercel's "Secret" vs "Config" setting — "Config" is more convenient since it can be viewed/edited later, but either works. Note: once a variable is saved as "Secret" it *cannot* be switched to "Config" afterward — you'd have to delete and recreate it.
3. `frontend/vercel.json` rewrites all paths to `index.html`, which React Router needs (otherwise refreshing `/dashboard` 404s).
4. Deploy.
5. **Firebase console → Authentication → Settings → Authorized domains**: add the Vercel domain. Without this, Google sign-in fails.
6. **After changing any `VITE_*` variable**, you must go to **Deployments → (latest) → ⋯ → Redeploy** — saving the variable alone does not rebuild the already-deployed site.

## 4. Verify

Open the Vercel URL, sign in with Google, look up a word, translate a sentence. If sign-in causes the page to reload repeatedly, that's almost always the database migration from step 1 not having been run (check Render's Logs tab for a Prisma `P2021` "table does not exist" error).

## Local development after deploying

`backend/.env` should stay pointed at your **local** Docker Postgres (`docker-compose.yml`) with `NODE_ENV=development` — don't leave it pointed at Neon/production between deploy sessions. `backend/.env.production.local` (gitignored) keeps a copy of the production values so you don't have to dig them out of Render's dashboard again next time.

## Known gaps

- **CORS is open to all origins** (`cors()` with no options in `backend/src/app.ts`). Fine to start; restrict to the Vercel domain once it's stable.
- **Rate limiting is in-memory** and resets on every Render restart/redeploy.
- **Render's free instance sleeps after inactivity**; the first request after that can take ~30-60s. Neon's free compute also auto-suspends after 5 minutes idle, adding a similar delay on its own first query.
- No custom domain, CI deploy gating, or staging environment — this covers a single production deploy of each service.
