-- =============================================================================
-- MULTI-SCHOOL MIGRATION
-- Converts the single-tenant NCSS Gateway schema into the shared Gateway
-- Platform: one app, one Supabase project, many schools — isolated by school_id
-- and enforced by Postgres Row Level Security (not by which URL you visited).
--
-- Run AFTER the existing 20260519120000_reviewer_expertise_routing.sql migration.
-- Review each section before running in production — this touches auth-adjacent
-- tables. Test against a Supabase branch/staging project first if you have one.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SCHOOLS — the new top-level entity everything else hangs off
-- -----------------------------------------------------------------------------
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,           -- e.g. 'ncss', used in invite links / URLs
  created_at timestamptz not null default now()
);

-- Seed your existing school so current NCSS data has somewhere to attach to.
insert into public.schools (name, slug)
values ('New Cairo STEM School', 'ncss')
on conflict (slug) do nothing;

-- -----------------------------------------------------------------------------
-- 2. school_id on profiles + submissions
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists school_id uuid references public.schools (id);

alter table public.submissions
  add column if not exists school_id uuid references public.schools (id);

-- Backfill existing NCSS rows onto the seeded school.
update public.profiles
   set school_id = (select id from public.schools where slug = 'ncss')
 where school_id is null;

update public.submissions
   set school_id = (select id from public.schools where slug = 'ncss')
 where school_id is null;

-- Now that everything's backfilled, make it required going forward.
alter table public.profiles alter column school_id set not null;
alter table public.submissions alter column school_id set not null;

create index if not exists profiles_school_idx on public.profiles (school_id);
create index if not exists submissions_school_idx on public.submissions (school_id);

-- -----------------------------------------------------------------------------
-- 3. Real admin role — replaces the hardcoded ADMIN_EMAIL in src/lib/admin.ts
-- -----------------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('applicant', 'reviewer', 'admin'));

-- Promote your current admin so nothing breaks the moment this ships.
update public.profiles
   set role = 'admin'
 where email = 'gtr92876@gmail.com';

-- -----------------------------------------------------------------------------
-- 4. Invites — schools are onboarded by you, not by self-serve signup.
--    A student/teacher gets a link containing an invite token; signing up
--    with that token assigns them to the right school_id automatically.
-- -----------------------------------------------------------------------------
create table if not exists public.school_invites (
  token uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools (id) on delete cascade,
  role text not null check (role in ('applicant', 'reviewer', 'admin')),
  email text,                          -- optional: lock the invite to one address
  used_at timestamptz,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days')
);

create index if not exists school_invites_school_idx on public.school_invites (school_id);

-- -----------------------------------------------------------------------------
-- 5. handle_new_user — now reads school_id + role off the invite token
--    (passed through auth signup as raw_user_meta_data ->> 'invite_token')
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_email text;
  invite record;
begin
  user_email := coalesce(new.email, new.raw_user_meta_data ->> 'email');
  if user_email is null or btrim(user_email) = '' then
    raise exception 'handle_new_user: auth user % has no email', new.id;
  end if;

  select * into invite
  from public.school_invites
  where token = (new.raw_user_meta_data ->> 'invite_token')::uuid
    and used_at is null
    and expires_at > now()
  limit 1;

  if invite is null then
    raise exception 'handle_new_user: no valid invite token for %', user_email;
  end if;

  insert into public.profiles (id, email, role, full_name, school_id, expertise_programs)
  values (
    new.id,
    user_email,
    invite.role,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(user_email, '@', 1)),
    invite.school_id,
    '{}'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  update public.school_invites set used_at = now() where token = invite.token;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RLS — the actual isolation boundary. Everything scoped by school_id.
-- -----------------------------------------------------------------------------
alter table public.schools enable row level security;
alter table public.school_invites enable row level security;

drop policy if exists "schools_select_authenticated" on public.schools;
create policy "schools_select_authenticated"
  on public.schools for select
  to authenticated
  using (true); -- school names aren't sensitive; fine to read broadly

-- Reviewers/admins can only see submissions from their OWN school.
drop policy if exists "submissions_select_authenticated" on public.submissions;
create policy "submissions_select_same_school"
  on public.submissions for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.school_id = submissions.school_id
    )
  );

drop policy if exists "submissions_insert_applicant" on public.submissions;
create policy "submissions_insert_applicant"
  on public.submissions for insert
  to authenticated
  with check (
    auth.uid() = student_user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'applicant'
        and p.school_id = submissions.school_id
    )
  );

drop policy if exists "submissions_update_reviewer" on public.submissions;
create policy "submissions_update_reviewer"
  on public.submissions for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role in ('reviewer', 'admin')
        and p.school_id = submissions.school_id
    )
  );

-- Invites: only admins can create/view invites for their own school.
drop policy if exists "invites_admin_manage" on public.school_invites;
create policy "invites_admin_manage"
  on public.school_invites for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.school_id = school_invites.school_id
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.school_id = school_invites.school_id
    )
  );

-- Public (unauthenticated) needs to READ one invite row by token to sign up —
-- but only enough to validate it, via a narrow function rather than a broad policy.
create or replace function public.validate_invite(p_token uuid)
returns table (school_id uuid, role text, school_name text)
language sql
security definer
set search_path = public
as $$
  select i.school_id, i.role, s.name
  from public.school_invites i
  join public.schools s on s.id = i.school_id
  where i.token = p_token
    and i.used_at is null
    and i.expires_at > now();
$$;
