-- نویسه cloud integration
-- Run this in Supabase SQL Editor. Token/state tables are backend-only.
create table if not exists public.drive_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  encrypted_refresh_token text not null,
  drive_folder_id text,
  backup_file_id text,
  connected_at timestamptz not null default now(),
  last_sync_at timestamptz
);

create table if not exists public.drive_oauth_states (
  state text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  return_to text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.drive_tokens enable row level security;
alter table public.drive_oauth_states enable row level security;

-- Deliberately do not create client-facing RLS policies for either table.
-- Only the Edge Function's service-role client may read/write OAuth secrets.
revoke all on public.drive_tokens from anon, authenticated;
revoke all on public.drive_oauth_states from anon, authenticated;

grant all on public.drive_tokens to service_role;
grant all on public.drive_oauth_states to service_role;

create index if not exists drive_oauth_states_expires_at_idx
  on public.drive_oauth_states (expires_at);
