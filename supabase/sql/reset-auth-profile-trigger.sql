-- =============================================================================
-- RESET: remove duplicate auth → profiles triggers, then install ONE canonical setup
-- Run the whole file once in Supabase SQL Editor.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- STEP 1 — See what is currently attached to auth.users (read-only)
-- -----------------------------------------------------------------------------
select
  t.tgname as trigger_name,
  p.proname as function_name,
  case t.tgenabled
    when 'O' then 'enabled'
    when 'D' then 'disabled'
    else t.tgenabled::text
  end as status
from pg_trigger t
join pg_class c on t.tgrelid = c.oid
join pg_namespace n on c.relnamespace = n.oid
join pg_proc p on t.tgfoid = p.oid
join pg_namespace fn on p.pronamespace = fn.oid
where n.nspname = 'auth'
  and c.relname = 'users'
  and not t.tgisinternal
order by t.tgname;

-- -----------------------------------------------------------------------------
-- STEP 2 — Drop EVERY user-defined trigger on auth.users that calls profile logic
-- (Safe: does not touch Supabase internal/system triggers)
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select t.tgname
    from pg_trigger t
    join pg_class c on t.tgrelid = c.oid
    join pg_namespace n on c.relnamespace = n.oid
    join pg_proc p on t.tgfoid = p.oid
    where n.nspname = 'auth'
      and c.relname = 'users'
      and not t.tgisinternal
      and (
        p.proname in ('handle_new_user', 'on_auth_user_created')
        or t.tgname ilike '%profile%'
        or t.tgname ilike '%user_created%'
        or t.tgname ilike '%new_user%'
      )
  loop
    execute format('drop trigger if exists %I on auth.users', r.tgname);
    raise notice 'Dropped trigger: %', r.tgname;
  end loop;
end;
$$;

-- Also drop by common fixed names (in case function name differs)
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists on_auth_user_created_trigger on auth.users;
drop trigger if exists handle_new_user_trigger on auth.users;
drop trigger if exists create_profile_for_new_user on auth.users;

-- -----------------------------------------------------------------------------
-- STEP 3 — Drop duplicate function definitions (all overloads)
-- -----------------------------------------------------------------------------
drop function if exists public.handle_new_user() cascade;

-- -----------------------------------------------------------------------------
-- STEP 4 — One function + one trigger (idempotent)
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
  user_role text;
begin
  user_email := coalesce(new.email, new.raw_user_meta_data ->> 'email');
  if user_email is null or btrim(user_email) = '' then
    raise exception 'handle_new_user: auth user % has no email', new.id;
  end if;

  user_role := coalesce(new.raw_user_meta_data ->> 'role', 'applicant');
  if user_role not in ('applicant', 'reviewer') then
    user_role := 'applicant';
  end if;

  insert into public.profiles (id, email, role, full_name, expertise_programs)
  values (
    new.id,
    user_email,
    user_role,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(user_email, '@', 1)),
    '{}'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- STEP 5 — Confirm exactly one trigger remains for handle_new_user
-- -----------------------------------------------------------------------------
select
  t.tgname as trigger_name,
  p.proname as function_name
from pg_trigger t
join pg_class c on t.tgrelid = c.oid
join pg_namespace n on c.relnamespace = n.oid
join pg_proc p on t.tgfoid = p.oid
where n.nspname = 'auth'
  and c.relname = 'users'
  and not t.tgisinternal
  and p.proname = 'handle_new_user';

-- Expected: exactly 1 row → on_auth_user_created | handle_new_user
