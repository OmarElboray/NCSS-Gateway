-- =============================================================================
-- School Portal: profiles + submissions + reviewer expertise routing
-- Run in Supabase SQL Editor or via: supabase db push
-- =============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- profiles (applicants + reviewers)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  role text not null check (role in ('applicant', 'reviewer')),
  full_name text,
  expertise_programs text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_expertise_gin_idx on public.profiles using gin (expertise_programs);

comment on column public.profiles.expertise_programs is
  'Programs this reviewer is qualified to review. Used for email routing.';

-- -----------------------------------------------------------------------------
-- submissions (applicant essays)
-- -----------------------------------------------------------------------------
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  student_user_id uuid references auth.users (id) on delete set null,
  student_name text not null,
  student_email text not null,
  program text not null,
  title text not null,
  essay text not null,
  status text not null default 'Pending'
    check (status in ('Pending', 'Under Review', 'Accepted', 'Rejected', 'Revision Requested')),
  feedback text not null default '',
  is_anonymous boolean not null default false,
  submitted_at date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists submissions_program_idx on public.submissions (program);
create index if not exists submissions_status_idx on public.submissions (status);

-- -----------------------------------------------------------------------------
-- updated_at trigger
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Auto-create profile on signup
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
  if user_email is null or user_email = '' then
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
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(user_email, '@', 1)),
    '{}'
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    updated_at = now();

  return new;
exception
  when others then
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    raise;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.submissions enable row level security;

-- Profiles: own row
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Reviewers can read all submissions
drop policy if exists "submissions_select_authenticated" on public.submissions;
create policy "submissions_select_authenticated"
  on public.submissions for select
  to authenticated
  using (true);

-- Applicants insert their own submissions
drop policy if exists "submissions_insert_applicant" on public.submissions;
create policy "submissions_insert_applicant"
  on public.submissions for insert
  to authenticated
  with check (
    auth.uid() = student_user_id
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'applicant'
    )
  );

-- Reviewers update submission status/feedback
drop policy if exists "submissions_update_reviewer" on public.submissions;
create policy "submissions_update_reviewer"
  on public.submissions for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'reviewer'
    )
  );

-- Service role (edge functions) bypasses RLS when using service_role key.
