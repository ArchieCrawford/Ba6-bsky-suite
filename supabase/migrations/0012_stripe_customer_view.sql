-- =========================================================
-- BA6 Bsky Suite: Stripe customer lookup view
-- =========================================================

begin;

create or replace view stripe.customers_by_supabase_user as
select
  id,
  deleted,
  metadata->>'supabase_user_id' as supabase_user_id,
  created
from stripe.customers;

commit;
