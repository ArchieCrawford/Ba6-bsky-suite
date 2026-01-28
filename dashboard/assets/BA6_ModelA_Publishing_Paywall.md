# Model A (Multi-tenant feedgen) + “User publishes from their Bluesky repo” + Paywall

Goal:
- BA6 hosts **one** feed generator service (multi-tenant).
- Each BA6 user can create many feed definitions in BA6.
- When they hit “Publish”, BA6 creates/updates the `app.bsky.feed.generator` record in **the user’s** Bluesky repo that points to BA6’s feed service DID.
- Free tier: limited feeds. Paid tier: more feeds.

## Why this works (protocol facts)

- A feed generator service can host one or more algorithms (feeds).
- Each feed algorithm is identified by the **at-uri** of an `app.bsky.feed.generator` record in some repo.
- That record points to the feed service’s DID; clients/AppView resolve the DID document and call `getFeedSkeleton`.
- BA6 can host the service; users can own the record. Best of both worlds.

## UX flow

1) User creates a feed in BA6 (slug, display info, sources, rules).
2) BA6 validates paywall limits:
   - if free tier and feed_count >= limit → block publish & show upgrade.
3) User clicks “Publish to Bluesky”
4) BA6 runs the auth flow (prefer OAuth; fallback to app password if needed).
5) BA6 calls `com.atproto.repo.createRecord` (first publish) or `putRecord` (update) to write:
   - collection: `app.bsky.feed.generator`
   - record value includes:
     - displayName, description, avatar (optional)
     - DID of your service (BA6 feedgen DID)
6) BA6 stores the returned at-uri + rkey in `public.feeds.published_*`
7) BA6 shows “Copy link / Add to Bluesky” instructions.

## Auth: OAuth first

Bluesky/AT Protocol OAuth is intended to replace app passwords over time.
Implement:
- “Connect Bluesky for publishing” button
- OAuth redirect/callback route in dashboard server
- Store refresh token securely (Supabase Vault)

Fallback:
- Let users paste an app password (stored via vault_secret_id), but clearly label it legacy and less ideal.

## Data changes (recommended)

Add to `public.feeds`:
- `published_uri text`
- `published_rkey text`
- `publisher_did text`
- `published_at timestamptz`
- `is_published boolean default false`

Add new table `public.entitlements` (or use wallets/subscriptions):
- `user_id uuid pk`
- `plan text` (free/pro/enterprise)
- `max_feeds int`
- `max_posts_per_day int`
- `renews_at timestamptz null`

Enforcement points:
- Dashboard “Create feed” and “Publish feed” should check limits.
- Feedgen should serve only `is_enabled=true` AND (optionally) `is_published=true`.

## Server API endpoints to add

- `POST /api/bsky/oauth/start` → returns authorization URL
- `GET /api/bsky/oauth/callback` → exchanges code, stores tokens (vault)
- `POST /api/feeds/publish` → creates/updates generator record in user repo
- `POST /api/feeds/unpublish` → optional: delete record or mark disabled
- `GET /api/entitlements` → returns plan/limits for UI gating

## Feed generator record mapping (multi-tenant)

The feed record’s at-uri is the feed identity.
Your feedgen service receives `feed=<at-uri>` and can map it back to BA6 feed row by:
- parse rkey from at-uri OR store `published_uri` and look up by equality.

If you want feeds to work *before* publishing:
- support BA6 internal URIs like `at://did:web:feeds.../app.bsky.feed.generator/<slug>`
…but for Bluesky clients, publishing a real record is what makes it discoverable.

## Paywall policy suggestions

Free:
- 1 published feed
- 1 draft feed (not published)
- limited refresh rules / sources

Pro:
- 10 feeds
- more sources and rules
- higher scheduler throughput

Enterprise:
- custom limits + dedicated worker

## Hardening

- Rate-limit publish attempts.
- Log every publish to `post_events`-like table `feed_publish_events`.
- Make DID and service endpoint configurable (staging vs prod).
