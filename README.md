Prisma + Supabase Local Deployment App (UI-first)

This repo now includes a minimal local-only tool to manage your Prisma/Supabase environments without the terminal:

- Edit `.env` profiles via UI (local/staging/prod)
- Test connections for Local, Shadow, Supabase Direct and Pooled
- Prepares ground for one-click Prisma actions (migrate dev/deploy, diff, pull)

Getting started

1) Install deps in both client and server:

```
npm install
cd server && npm install && cd ..
```

2) Start the backend (localhost only):

```
npm run dev
```

Server runs at `http://localhost:6580`.

3) In a separate terminal, start the React client:

```
npm run dev
```

Client runs at `http://localhost:6581`.

4) Open the app and use the Environment Profiles screen to:

- Choose active profile (local/staging/prod)
- Enter URLs for `LOCAL_DATABASE_URL`, `SHADOW_DATABASE_URL`, `DATABASE_URL` (pooled), `DIRECT_URL` (direct)
- Click Save to persist to `.env` (gitignored)
- Click Test next to any URL to validate connectivity and latency

An `.env.example` is provided with typical Supabase formats.

Notes

- The backend only binds to `127.0.0.1` and uses strict CORS for local Vite origins.
- No secrets are sent anywhere except to the local server for connection testing.
- Next steps (not yet wired): streaming Prisma CLI, migrations, backups, and diffs.
