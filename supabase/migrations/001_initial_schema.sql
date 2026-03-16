-- ============================================================
-- Character Forge — Initial Schema
-- Safe to re-run: all statements are idempotent.
-- ============================================================

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── Tiers ───────────────────────────────────────────────────────────────────
create table if not exists public.tiers (
  id                  text primary key,
  display_name        text not null,
  monthly_image_limit integer,
  monthly_story_limit integer,
  daily_image_limit   integer,
  daily_story_limit   integer,
  sort_order          integer not null default 0
);

insert into public.tiers (id, display_name, monthly_image_limit, monthly_story_limit, daily_image_limit, daily_story_limit, sort_order)
values
  ('free',       'Free',       15,   3,   null, null, 0),
  ('pro',        'Pro',        100,  20,  null, null, 1),
  ('enterprise', 'Enterprise', null, null, 100, 25,  2)
on conflict (id) do update set
  display_name        = excluded.display_name,
  monthly_image_limit = excluded.monthly_image_limit,
  monthly_story_limit = excluded.monthly_story_limit,
  daily_image_limit   = excluded.daily_image_limit,
  daily_story_limit   = excluded.daily_story_limit,
  sort_order          = excluded.sort_order;

-- ─── Profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  avatar_url   text,
  tier_id      text not null default 'free' references public.tiers(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Trigger function: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger function: auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── Usage Tracking ──────────────────────────────────────────────────────────
create table if not exists public.usage (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in ('image', 'story')),
  period     date not null,
  count      integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, type, period)
);

drop trigger if exists usage_updated_at on public.usage;
create trigger usage_updated_at
  before update on public.usage
  for each row execute function public.set_updated_at();

-- ─── Storylines ──────────────────────────────────────────────────────────────
create table if not exists public.storylines (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  name                text not null,
  storyline_art_style text,
  storyline_prompt_id uuid,
  storyline_metadata  jsonb default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

drop trigger if exists storylines_updated_at on public.storylines;
create trigger storylines_updated_at
  before update on public.storylines
  for each row execute function public.set_updated_at();

-- ─── Storyline Prompts ───────────────────────────────────────────────────────
create table if not exists public.storyline_prompts (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  storyline_id uuid references public.storylines(id) on delete set null,
  raw_response text,
  section_a    text,
  section_b    text,
  section_c    text,
  form_payload jsonb default '{}',
  token_tier   text check (token_tier in ('lite', 'standard', 'rich')),
  created_at   timestamptz not null default now()
);

-- Add FK from storylines → storyline_prompts (deferred because of circular reference)
-- Wrapped in DO block because ALTER TABLE ADD CONSTRAINT has no IF NOT EXISTS
do $$
begin
  if not exists (
    select 1
    from   pg_constraint c
    join   pg_class t on t.oid = c.conrelid
    join   pg_namespace n on n.oid = t.relnamespace
    where  c.conname = 'fk_storyline_prompt'
    and    n.nspname = 'public'
    and    t.relname = 'storylines'
  ) then
    alter table public.storylines
      add constraint fk_storyline_prompt
      foreign key (storyline_prompt_id)
      references public.storyline_prompts(id)
      on delete set null;
  end if;
end;
$$;

-- ─── Character Batches ───────────────────────────────────────────────────────
create table if not exists public.character_batches (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references public.profiles(id) on delete cascade,
  storyline_id          uuid references public.storylines(id) on delete set null,
  name                  text not null,
  reference_image_url   text,
  reference_image_urls  text[] default '{}',
  prop_image_url        text,
  character_description text,
  status                text default 'pending',
  image_count           integer default 0,
  aspect_ratio          text default '3:4',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

drop trigger if exists character_batches_updated_at on public.character_batches;
create trigger character_batches_updated_at
  before update on public.character_batches
  for each row execute function public.set_updated_at();

-- ─── Generated Images ────────────────────────────────────────────────────────
create table if not exists public.generated_images (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  batch_id   uuid not null references public.character_batches(id) on delete cascade,
  url        text not null,
  label      text,
  category   text,
  created_at timestamptz not null default now()
);

-- ─── Row-Level Security ──────────────────────────────────────────────────────
alter table public.tiers              enable row level security;
alter table public.profiles           enable row level security;
alter table public.usage              enable row level security;
alter table public.storylines         enable row level security;
alter table public.storyline_prompts  enable row level security;
alter table public.character_batches  enable row level security;
alter table public.generated_images   enable row level security;

-- ─── Policies ────────────────────────────────────────────────────────────────
-- Drop first so re-runs don't error on "already exists"

-- tiers
drop policy if exists "tiers_read_all" on public.tiers;
create policy "tiers_read_all" on public.tiers
  for select using (true);

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- usage
drop policy if exists "usage_select_own" on public.usage;
create policy "usage_select_own" on public.usage
  for select using (auth.uid() = user_id);

drop policy if exists "usage_insert_own" on public.usage;
create policy "usage_insert_own" on public.usage
  for insert with check (auth.uid() = user_id);

drop policy if exists "usage_update_own" on public.usage;
create policy "usage_update_own" on public.usage
  for update using (auth.uid() = user_id);

-- storylines
drop policy if exists "storylines_select_own" on public.storylines;
create policy "storylines_select_own" on public.storylines
  for select using (auth.uid() = user_id);

drop policy if exists "storylines_insert_own" on public.storylines;
create policy "storylines_insert_own" on public.storylines
  for insert with check (auth.uid() = user_id);

drop policy if exists "storylines_update_own" on public.storylines;
create policy "storylines_update_own" on public.storylines
  for update using (auth.uid() = user_id);

drop policy if exists "storylines_delete_own" on public.storylines;
create policy "storylines_delete_own" on public.storylines
  for delete using (auth.uid() = user_id);

-- storyline_prompts
drop policy if exists "storyline_prompts_select_own" on public.storyline_prompts;
create policy "storyline_prompts_select_own" on public.storyline_prompts
  for select using (auth.uid() = user_id);

drop policy if exists "storyline_prompts_insert_own" on public.storyline_prompts;
create policy "storyline_prompts_insert_own" on public.storyline_prompts
  for insert with check (auth.uid() = user_id);

drop policy if exists "storyline_prompts_update_own" on public.storyline_prompts;
create policy "storyline_prompts_update_own" on public.storyline_prompts
  for update using (auth.uid() = user_id);

drop policy if exists "storyline_prompts_delete_own" on public.storyline_prompts;
create policy "storyline_prompts_delete_own" on public.storyline_prompts
  for delete using (auth.uid() = user_id);

-- character_batches
drop policy if exists "character_batches_select_own" on public.character_batches;
create policy "character_batches_select_own" on public.character_batches
  for select using (auth.uid() = user_id);

drop policy if exists "character_batches_insert_own" on public.character_batches;
create policy "character_batches_insert_own" on public.character_batches
  for insert with check (auth.uid() = user_id);

drop policy if exists "character_batches_update_own" on public.character_batches;
create policy "character_batches_update_own" on public.character_batches
  for update using (auth.uid() = user_id);

drop policy if exists "character_batches_delete_own" on public.character_batches;
create policy "character_batches_delete_own" on public.character_batches
  for delete using (auth.uid() = user_id);

-- generated_images
drop policy if exists "generated_images_select_own" on public.generated_images;
create policy "generated_images_select_own" on public.generated_images
  for select using (auth.uid() = user_id);

drop policy if exists "generated_images_insert_own" on public.generated_images;
create policy "generated_images_insert_own" on public.generated_images
  for insert with check (auth.uid() = user_id);

drop policy if exists "generated_images_update_own" on public.generated_images;
create policy "generated_images_update_own" on public.generated_images
  for update using (auth.uid() = user_id);

drop policy if exists "generated_images_delete_own" on public.generated_images;
create policy "generated_images_delete_own" on public.generated_images
  for delete using (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
create index if not exists idx_storylines_user_id      on public.storylines(user_id);
create index if not exists idx_character_batches_user  on public.character_batches(user_id);
create index if not exists idx_character_batches_story on public.character_batches(storyline_id);
create index if not exists idx_generated_images_batch  on public.generated_images(batch_id);
create index if not exists idx_generated_images_user   on public.generated_images(user_id);
create index if not exists idx_usage_user_period       on public.usage(user_id, period);
create index if not exists idx_storyline_prompts_user  on public.storyline_prompts(user_id);
