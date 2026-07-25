-- Run this in Supabase: Project > SQL Editor > New query > paste > Run.

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  groq_api_key text,
  updated_at timestamptz default now()
);

alter table public.user_settings enable row level security;

create policy "users manage their own settings"
  on public.user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text,
  question text,
  answer text,
  score int,
  strengths jsonb,
  improvements jsonb,
  created_at timestamptz default now()
);

alter table public.practice_sessions enable row level security;

create policy "users manage their own sessions"
  on public.practice_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
