alter table public.scheduled_posts
  add column if not exists locked_by text;

create or replace function public.claim_next_scheduled_post(
  lock_seconds int,
  worker_id text
)
returns setof public.scheduled_posts
language plpgsql
security definer
as $$
begin
  return query
  with candidate as (
    select sp.id
    from public.scheduled_posts sp
    where sp.status = 'queued'
      and sp.run_at <= now()
      and (
        sp.locked_at is null
        or sp.locked_at < (now() - make_interval(secs => lock_seconds))
      )
    order by sp.run_at asc
    limit 1
    for update skip locked
  )
  update public.scheduled_posts sp
  set status = 'posting',
      locked_at = now(),
      locked_by = worker_id,
      updated_at = now()
  from candidate
  where sp.id = candidate.id
  returning sp.*;
end;
$$;
