# Deploying PMFK with GitHub

PMFK is a full-stack app:

- **Frontend** — React + Vite (builds to `dist/`)
- **Backend** — Node + Express + WebSockets (accounts, sync, live lessons)

GitHub is the perfect home for the **code**. For **hosting**, you have two options below.

---

## Option A — Full app (recommended): GitHub + Render (free)

This runs the whole app (accounts, cloud sync, live lessons) because it runs the Node server.

1. **Push this folder to GitHub**
   ```powershell
   git init
   git add .
   git commit -m "PMFK initial release"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/pmfk.git
   git push -u origin main
   ```

2. **Deploy on Render (free)**
   - Go to **render.com** → sign in with GitHub
   - **New → Blueprint** → connect your `pmfk` repo
   - It reads `render.yaml` automatically → click **Apply**
   - You get a live URL like `https://pmfk.onrender.com`

3. Share that URL with families.

> ⚠️ **Free-tier note:** Render's free plan restarts idle apps and has a temporary disk, so the local `server/data` file can reset. For production, connect a free **Supabase** or **Neon Postgres** database (I can add this next).

---

## Option B — Static site only: GitHub Pages (free, forever)

GitHub Pages serves **static files only** — it **cannot** run accounts, sync, or live lessons.

The app still works in **offline/demo mode** (try the demo family), but "Create account" needs the backend.

1. In your repo → **Settings → Pages**
2. Source: **Deploy from a branch** → `main` → `/ (root)` (or `dist` via an action)
3. Visit `https://YOUR-USERNAME.github.io/pmfk`

**For the full app on GitHub Pages**, pair it with Option A's server and set the API URL — ask me to wire that up.

---

## Running locally

```powershell
npm install
npm run dev:all   # web + server
```

Then open http://localhost:5173 (web) — the server runs on http://localhost:4000.

To run the production build exactly like the host:

```powershell
npm run build
npm start         # serves app + API on http://localhost:4000
```

---

## Option C — Free database (Supabase or Neon Postgres)

Free hosts have temporary disks. To make accounts survive restarts forever, connect a free Postgres:

1. **Supabase** (supabase.com) → New project → Settings → Database → copy the **connection string**
   - or **Neon** (neon.tech) → New project → copy the connection string

2. On Render (or your host), add an environment variable:
   ```
   DATABASE_URL=postgres://...your-connection-string...
   ```

3. The server detects `DATABASE_URL` and automatically stores all accounts and data in Postgres instead of the local file. No code changes needed.

> Without `DATABASE_URL`, the app still works — it just stores data in a local file (resets when a free host restarts).

---

## Option D — GitHub Pages (static, automated)

The repo includes `.github/workflows/deploy-pages.yml`, so every push to `main` auto-deploys.

1. Push to GitHub (see Option A, step 1)
2. In your repo → **Settings → Pages → Source: GitHub Actions**
3. The workflow builds and deploys `dist/` automatically
4. Your site: `https://YOUR-USERNAME.github.io/pmfk/`

**GitHub Pages is static-only**, so accounts/sync/live lessons need the backend. To connect them, set the backend URL as a build secret:

- Repo → **Settings → Secrets and variables → Actions → New repository secret**
  - Name: `VITE_API_URL` · Value: `https://pmfk.onrender.com`
- Add it to the workflow's build step as an env var (I can wire this in when you have the URL).

Without a backend, GitHub Pages still runs the app fully in **offline/demo mode**.

---

Made by **Shawn Kong**.
