-- ============================================================
-- RPC: increment_usage
-- Atomically upserts the usage counter for a user/type/period.
-- Called from the client after each successful generation.
-- ============================================================

create or replace function public.increment_usage(
  p_user_id uuid,
  p_type    text,
  p_period  date,
  p_amount  integer default 1
)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.usage (user_id, type, period, count)
  values (p_user_id, p_type, p_period, p_amount)
  on conflict (user_id, type, period)
  do update set
    count      = public.usage.count + excluded.count,
    updated_at = now();
end;
$$;

-- Grant execute to authenticated users
grant execute on function public.increment_usage(uuid, text, date, integer) to authenticated;
