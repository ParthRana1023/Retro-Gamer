create extension if not exists pgcrypto;

create table if not exists public.save_states (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  rom_id text not null,
  slot text not null,
  save_type text not null,
  state_data jsonb not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint save_states_user_slot_unique unique (user_id, rom_id, slot, save_type)
);

create index if not exists save_states_user_lookup_idx
  on public.save_states (user_id, rom_id, slot, save_type);

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_save_states_updated_at on public.save_states;

create trigger set_save_states_updated_at
before update on public.save_states
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.save_states enable row level security;

drop policy if exists "Users can read save states" on public.save_states;
drop policy if exists "Users can insert save states" on public.save_states;
drop policy if exists "Users can update save states" on public.save_states;
drop policy if exists "Users can delete save states" on public.save_states;
drop policy if exists "Users can read their own save states" on public.save_states;
drop policy if exists "Users can insert their own save states" on public.save_states;
drop policy if exists "Users can update their own save states" on public.save_states;
drop policy if exists "Users can delete their own save states" on public.save_states;

create policy "Users can read their own save states"
  on public.save_states
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own save states"
  on public.save_states
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own save states"
  on public.save_states
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own save states"
  on public.save_states
  for delete
  to authenticated
  using (auth.uid() = user_id);
