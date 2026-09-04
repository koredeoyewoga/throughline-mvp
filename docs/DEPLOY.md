# Deploying the demo

The MVP runs as a single Next.js app. Locally it persists to `.data/`; on a
serverless host it uses `/tmp` (per-instance, cleared on cold start), which is
fine for a demo — state holds while an instance is warm and otherwise re-seeds
from the synthetic world. Nothing here is real data.

## Netlify (shareable link)

### One-time setup

1. Push this repo to GitHub (already done for the reference deployment).
2. In Netlify: **Add new site → Import an existing project → GitHub →** pick the
   repo. `netlify.toml` supplies the build command and the Next.js runtime; no
   other build config is needed.
3. **Site configuration → Environment variables**, add:

   | Key | Value | Why |
   |---|---|---|
   | `THROUGHLINE_SESSION_SECRET` | a long random string (e.g. `openssl rand -hex 32`) | signs the session cookie — **required** for a shared deployment |
   | `THROUGHLINE_AUTH` | `on` (default) or `off` | `off` skips the login screen and runs as the demo coordinator — use it if you want a zero-friction link |

   Everything else is optional (see `.env.example`). Do **not** set
   `THROUGHLINE_DATA_DIR` — the app picks `/tmp` on Netlify automatically.
4. **Deploy site.** The build takes ~2 minutes. Share the `*.netlify.app` URL.

### What the visitor sees

- With `THROUGHLINE_AUTH=on`: a **Sign in** screen — one click picks a demo
  identity (Priya Shah / coordinator, Alan Reeve / oversight, Nadia Kern / a
  different place). This shows off RBAC + tenancy.
- With `THROUGHLINE_AUTH=off`: straight to the attention queue as the
  coordinator.

"Reset demo to seed" in the UI restores the starting state at any time.

### CLI alternative

```bash
npm i -g netlify-cli
netlify login
netlify init          # link to a site
netlify env:set THROUGHLINE_SESSION_SECRET "$(openssl rand -hex 32)"
netlify deploy --build --prod
```

## Running it on your own machine

```bash
npm install
npm run dev            # http://localhost:3000
```

No env vars required locally — auth runs with a dev signing secret and state
persists to `.data/`.

## Notes / limits of the demo deployment

- **State is per-instance and ephemeral.** Two people hitting the link at once
  may land on different lambda instances with independent state, and a cold
  start re-seeds. For a single viewer walking through the flow it behaves as
  expected. A shared, durable datastore (Postgres / Netlify Blobs behind
  `src/store/db.ts`) is Phase 12.
- **No real integrations.** `THROUGHLINE_SOURCE` defaults to the synthetic seed.
- The service worker only registers in a production build; on Netlify it will,
  so the app is installable from the deployed URL.
