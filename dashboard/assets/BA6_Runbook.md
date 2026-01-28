# BA6 Bluesky Suite — Runbook

This repo is a **multi-service** Bluesky ops platform:

- **dashboard/**: Next.js dashboard UI + server routes
- **feedgen/**: Feed Generator service (`getFeedSkeleton`)
- **worker/**: background runner for scheduled posts + AI image jobs
- **supabase/**: SQL migrations (DB schema + RPCs)
- **support/**: Nextra docs site
- **render.yaml**: Render deployment definition

## 1) Prerequisites

- Node.js (match `.nvmrc` at repo root and in `feedgen/`)
- Supabase project (DB + Auth + Storage)
- A domain for feed DID (prod example: `feeds.ba6-bsky-suite.com`)
- Venice API key (for AI features)
- (Optional but recommended) Bluesky OAuth app registration if you want OAuth-based publishing

## 2) Environment variables (by service)

### Dashboard (Next.js)

Set these in `dashboard/.env.local` (and in Vercel/Render env for prod):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (only for server routes that must bypass RLS)
- `VENICE_API_KEY`
- `VENICE_API_BASE` (if you support non-default base URL)
- `FEEDGEN_PUBLIC_BASE_URL` (ex: `https://feeds.ba6-bsky-suite.com`)

If you implement user-owned publishing via OAuth:
- `ATPROTO_OAUTH_CLIENT_ID`
- `ATPROTO_OAUTH_CLIENT_SECRET`
- `ATPROTO_OAUTH_REDIRECT_URI`

### Worker

Set these in `worker/.env` (and prod env):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VENICE_API_KEY`
- `AI_STORAGE_BUCKET=ai` (matches migrations)
- `WORKER_ID` (unique string per instance)

### Feedgen

Set these in `feedgen/.env` (and prod env):

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FEEDGEN_DID_WEB` (ex: `did:web:feeds.ba6-bsky-suite.com`)
- `FEEDGEN_SERVICE_ENDPOINT` (ex: `https://feeds.ba6-bsky-suite.com`)
- `FEEDGEN_PUBLIC_HOSTNAME` (optional; used for logging/headers)

## 3) Database setup (Supabase)

### Apply migrations (IMPORTANT)

Run migrations **in order**, because later migrations assume earlier tables/columns exist.

Files in `supabase/migrations/`:

- `0001_init.sql`
- `0002_claim_rpc.sql`
- `0003_worker_heartbeat.sql`
- `0004_multi_user_optional_accounts.sql`
- `0005_ai_images.sql`
- `0005_vault_secrets.sql`

**Schema mismatch warning:** your app code expects `public.users` and `public.accounts`, but `0001_init.sql` currently creates `public.profiles`, `public.bsky_accounts`, and `public.bsky_sessions`.

You should do one of these fixes (recommended order):
1. **Create canonical tables** `public.users` and `public.accounts` and migrate data from legacy tables; OR
2. Create **views** named `users` and `accounts` that map to legacy tables; OR
3. Update the app code to use legacy table names.

The clean long-term choice is (1). See the Schema Doc for a suggested “canonical schema”.

### Storage bucket

Create a Storage bucket named: `ai`

Worker will upload generated images and write rows into `ai_assets`.

## 4) Local development

From repo root:

1) Install deps
```bash
npm i
```

2) Run each service in separate terminals (recommended)

Dashboard:
```bash
cd dashboard
npm i
npm run dev
```

Feedgen:
```bash
cd feedgen
npm i
npm run dev
```

Worker:
```bash
cd worker
npm i
npm run dev
```

Support docs:
```bash
cd support
npm i
npm run dev
```

## 5) Production deploy (Render)

`render.yaml` defines 3 services:
- dashboard (web)
- feedgen (web)
- worker (background worker)

Checklist:
- Set env vars for each service
- Ensure feedgen domain serves `/.well-known/did.json` for `did:web`
- Confirm Supabase RLS policies allow intended access
- Confirm RPCs are granted to `service_role`
- Validate worker heartbeat page renders in dashboard

## 6) Troubleshooting

### Feed shows blank / errors in Bluesky client
- Confirm feed record points to the correct service DID.
- Confirm your `did:web` document exists at:
  - `https://<feed-domain>/.well-known/did.json`
- Confirm service endpoint in DID doc matches your feedgen public URL.

### Scheduled posts stuck in `queued`
- Worker not running or cannot claim due rows.
- Check `worker_heartbeats` table and dashboard heartbeat page.
- Verify `claim_next_scheduled_post` RPC exists and is granted to `service_role`.
- Verify scheduled posts have `account_id` and `account_did` set (migration 0004 intentionally prevents claiming otherwise).

### Venice image jobs stuck in `queued`
- Confirm `claim_next_ai_image_job` exists + worker env has Venice key.
- Confirm Storage bucket `ai` exists and worker has rights.

### “column does not exist” errors in dashboard
- Run migrations in order.
- Ensure the schema matches what the UI queries (feeds columns added in 0004).

### Staging vs prod DID mismatch
- Do not hard-code `did:web:feeds.ba6-bsky-suite.com`.
- Make it an env var in feedgen and in the “publish feed” path.
