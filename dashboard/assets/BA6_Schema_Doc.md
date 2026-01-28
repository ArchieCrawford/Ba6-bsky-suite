# BA6 Bluesky Suite — Schema Doc (Table-by-table)

This doc describes the **expected** tables based on:
- `supabase/migrations/*.sql`
- what the dashboard/worker/feedgen query in code

## Reality check: schema naming mismatch (must fix)

`0001_init.sql` creates:
- `public.profiles`
- `public.bsky_accounts`
- `public.bsky_sessions`

But the app code uses:
- `public.users`
- `public.accounts`

You should standardize on **users + accounts** (recommended), then either:
- migrate old tables into the new names, or
- create compatibility views.

## Tables

### 1) `public.users` (expected by app)
Purpose: one row per Supabase auth user, for display metadata.

Columns (suggested canonical):
- `id uuid pk` → `auth.users(id)`
- `display_name text null`
- `created_at timestamptz default now()`

Used by:
- dashboard `ensureUserProfile()` to verify user bootstrap row exists.

Notes:
- Migration `0004_multi_user_optional_accounts.sql` defines trigger `handle_new_auth_user()` which inserts into `public.users`. Ensure the table exists.

### 2) `public.accounts` (expected by app)
Purpose: connected Bluesky accounts per BA6 user.

Observed in code:
- `id uuid`
- `user_id uuid`
- `account_did text`
- `handle text`
- `label text null`
- `is_active boolean`
- `vault_secret_id uuid null` (vault-backed app password / token)

Canonical columns (recommended):
- `id uuid pk default gen_random_uuid()`
- `user_id uuid not null references auth.users(id)`
- `account_did text not null`
- `handle text null`
- `label text null`
- `is_active boolean not null default true`
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`
- `vault_secret_id uuid null`

Constraints:
- unique `(user_id, account_did)` per migration 0004.

Security:
- RLS: user can CRUD their own accounts; service_role can read for worker publishing.

### 3) `public.drafts`
Purpose: post drafts authored in dashboard.

From 0001:
- `id uuid pk`
- `user_id uuid`
- `text text`
- `created_at`, `updated_at`

Used by:
- dashboard drafts page
- scheduler page (select draft to schedule)

### 4) `public.scheduled_posts`
Purpose: queued posts to be sent by worker.

Key columns (from 0001 + 0004):
- `id uuid pk`
- `user_id uuid`
- `draft_id uuid references drafts`
- `account_id uuid null` (made nullable in 0004)
- `account_did text null` (made nullable in 0004)
- `run_at timestamptz`
- `status text` (queued/posting/posted/failed)
- `attempt_count int`
- `locked_at timestamptz null`
- `locked_by text null`
- `created_at`, `updated_at`

RPC:
- `claim_next_scheduled_post(lock_seconds, worker_id)` updates one row to `posting` and returns it.

### 5) `public.post_events`
Purpose: audit trail for scheduling/posting.

Columns include:
- `id uuid pk`
- `scheduled_post_id uuid`
- `type text` (claimed/success/failure)
- `detail jsonb`
- timestamps

### 6) Feed system

#### `public.feeds`
Purpose: feed definitions per user.

From 0001 + 0004:
- `id uuid pk`
- `user_id uuid`
- `slug text`
- `title text null` (added 0004)
- `display_name text null` (added 0004)
- `description text null` (added 0004)
- `is_enabled boolean default true` (added 0004)
- `created_at`, `updated_at`

Constraints:
- unique `(user_id, slug)` via `feeds_user_slug_key`.

Recommended additional columns for “user publishes to their repo”:
- `published_uri text null` (at-uri of generator record)
- `published_rkey text null`
- `publisher_did text null` (user’s DID that owns the record)
- `published_at timestamptz null`

#### `public.feed_sources`
Purpose: which authors/content sources are included.

Columns (from 0001):
- `id uuid pk`
- `feed_id uuid`
- `actor_did text` (author DID)
- timestamps

#### `public.feed_rules`
Purpose: include/exclude keyword rules + optional lang.

Columns (from 0001):
- `id uuid pk`
- `feed_id uuid`
- `kind text` (include/exclude)
- `value text` (keyword)
- `lang text null`
- timestamps

#### `public.indexed_posts`
Purpose: “feed materialized view” for feedgen to return quickly.

From 0001:
- `id uuid pk`
- `feed_id uuid null` (varies)
- `uri text` (at-uri)
- `cid text`
- `author_did text`
- `text text`
- `lang text`
- `created_at timestamptz`
- plus indexing

Used by:
- feedgen to return skeleton lists quickly

### 7) Worker monitoring

#### `public.worker_heartbeats` (0003)
Purpose: dashboard shows last-seen of worker instances.

Columns:
- `worker_id text pk`
- `last_seen_at timestamptz`
- `detail jsonb`

### 8) AI images

#### `public.ai_jobs` (0005_ai_images)
Purpose: queue items for image generation (and future AI tasks).

Columns (high level):
- `id uuid pk`
- `user_id uuid`
- `provider text` (venice)
- `model text`
- `prompt text`
- `params jsonb` (size, steps, etc.)
- `status text` (queued/running/succeeded/failed)
- `attempt_count`
- `locked_at`, `locked_by`
- timestamps

RPC:
- `claim_next_ai_image_job(...)` (defined in migration) for worker.

#### `public.ai_assets`
Purpose: output artifacts (stored in Supabase Storage).

Columns:
- `id uuid pk`
- `job_id uuid`
- `bucket text`
- `path text`
- `mime text`
- `width/height` (if tracked)
- timestamps

#### `public.ai_job_events`
Purpose: audit trail for ai job lifecycle.

### 9) Vault secrets (0005_vault_secrets)

- Adds `accounts.vault_secret_id uuid`
- Adds RPCs:
  - `create_account_secret(secret, name, description) -> uuid`
  - `get_account_secret(account_id) -> text`

These run as `security definer` and allow `authenticated` + `service_role`.

## Optional: `ai_text_runs`

Your current code treats this as optional (“usage logging only”). If you want **hard enforcement + audit**, add a migration that creates:

- `public.ai_text_runs(id, user_id, provider, model, prompt_hash, input_tokens, output_tokens, created_at)`
- plus an index on `(user_id, created_at)`
- and a daily-limit RPC for atomic enforcement.
