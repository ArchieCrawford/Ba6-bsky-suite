# BA6 Bluesky Suite (starter)

This repo provides a minimal Supabase schema, a scheduler worker that posts to Bluesky, and a feed generator service that serves feed skeletons from indexed posts.

## Layout

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_claim_rpc.sql`
- `supabase/migrations/0003_worker_heartbeat.sql`
- `worker/` (scheduler poster)
- `feedgen/` (feed skeleton service)
- `dashboard/` (Next.js control panel)

## Environment

Copy `.env.example` into each service directory and fill in Supabase credentials.

```bash
cp .env.example worker/.env
cp .env.example feedgen/.env
```

For the dashboard, copy the dashboard env example:

```bash
cp dashboard/.env.example dashboard/.env.local
```

## Supabase migration

Run the migration in the Supabase dashboard SQL editor, or with the Supabase CLI:

```bash
supabase db push
```

## Worker (scheduler)

```bash
cd worker
npm i
npm run dev
```

## Feed generator

```bash
cd feedgen
npm i
npm run dev
```

Local feed endpoint:

```
http://localhost:8080/xrpc/app.bsky.feed.getFeedSkeleton?feed=ba6-systems-notes&limit=25
```

## Dashboard (Next.js)

```bash
cd dashboard
npm i
npm run dev
```

The app expects `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `dashboard/.env.local`.

## Run everything (from repo root)

Install dependencies once per folder as needed:

```bash
npm i
cd worker && npm i
cd ../feedgen && npm i
cd ../dashboard && npm i
```

Then run all three services at once:

```bash
cd ..
npm run dev:all
```

## Connect Bluesky (app password)

This is a simple CLI flow that stores `bsky_accounts` and `bsky_sessions` using the Supabase service key.

```bash
cd worker
npm run connect -- --user YOUR_AUTH_USER_UUID --handle your.handle --app-password your-app-password
```

You can also use env vars: `BSKY_USER_ID`, `BSKY_HANDLE`, `BSKY_APP_PASSWORD`, and `BLUESKY_SERVICE`.

## Indexing note

The worker inserts successful posts into `indexed_posts` so feeds work immediately for scheduled posts. You can replace this with a fuller indexer later.

## Seed example (run once)

```sql
insert into public.feeds (user_id, slug, display_name, description)
values ('YOUR_AUTH_USER_UUID', 'ba6-systems-notes', 'BA6 - Systems Notes', 'Power, order, institutions');

insert into public.feed_sources (feed_id, source_type, account_did)
select id, 'account_list', 'YOUR_BSKY_DID'
from public.feeds
where slug = 'ba6-systems-notes';

insert into public.feed_rules (feed_id, include_keywords, exclude_keywords, lang)
select id, array['systems note'], array[]::text[], null
from public.feeds
where slug = 'ba6-systems-notes';
```
