create extension if not exists "pgcrypto";

do $$ begin
  create type public.game_mode as enum ('initials', 'team-battle', 'imposter', 'five-teams');
exception
  when duplicate_object then null;
end $$;

alter type public.game_mode add value if not exists 'imposter';
alter type public.game_mode add value if not exists 'five-teams';

do $$ begin
  create type public.room_phase as enum ('lobby', 'countdown', 'playing', 'reveal', 'leaderboard', 'team_showing', 'imposter', 'finished');
exception
  when duplicate_object then null;
end $$;

alter type public.room_phase add value if not exists 'team_showing';
alter type public.room_phase add value if not exists 'imposter';

do $$ begin
  create type public.vote_value as enum ('accept', 'reject');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) = 6),
  host_player_id uuid,
  game_mode public.game_mode not null default 'initials',
  target_score integer not null default 10 check (target_score in (5, 10, 15)),
  five_team_seconds integer not null default 10 check (five_team_seconds between 5 and 60),
  phase public.room_phase not null default 'lobby',
  current_round integer not null default 0,
  initials text,
  team_a text,
  team_b text,
  imposter_player_id uuid,
  imposter_player_name text,
  imposter_clue text,
  phase_ends_at timestamptz,
  winner_player_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rooms add column if not exists five_team_seconds integer not null default 10;
alter table public.rooms drop constraint if exists rooms_five_team_seconds_check;
alter table public.rooms add constraint rooms_five_team_seconds_check check (five_team_seconds between 5 and 60);
alter table public.rooms add column if not exists imposter_player_id uuid;
alter table public.rooms add column if not exists imposter_player_name text;
alter table public.rooms add column if not exists imposter_clue text;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  nickname text not null check (char_length(nickname) between 1 and 24),
  is_host boolean not null default false,
  score integer not null default 0 check (score >= 0),
  session_token_hash text,
  joined_at timestamptz not null default now()
);

alter table public.players add column if not exists session_token_hash text;

alter table public.rooms
  drop constraint if exists rooms_host_player_id_fkey;

alter table public.rooms
  add constraint rooms_host_player_id_fkey
  foreign key (host_player_id) references public.players(id) on delete set null;

alter table public.rooms
  drop constraint if exists rooms_winner_player_id_fkey;

alter table public.rooms
  add constraint rooms_winner_player_id_fkey
  foreign key (winner_player_id) references public.players(id) on delete set null;

create table if not exists public.answers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  player_id uuid not null references public.players(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 80),
  normalized_text text not null,
  is_valid boolean,
  created_at timestamptz not null default now(),
  unique (room_id, round_number, player_id, normalized_text)
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  answer_id uuid not null references public.answers(id) on delete cascade,
  voter_player_id uuid not null references public.players(id) on delete cascade,
  vote public.vote_value not null,
  created_at timestamptz not null default now(),
  unique (answer_id, voter_player_id)
);

create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  room_id uuid not null references public.rooms(id) on delete cascade,
  round_number integer not null check (round_number > 0),
  game_mode public.game_mode not null,
  player_id uuid not null references public.players(id) on delete cascade,
  delta integer not null,
  reason text not null check (reason in ('initials-finalize', 'team-battle-award', 'five-teams-manual')),
  created_by_player_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by_player_id uuid references public.players(id) on delete set null
);

create index if not exists rooms_code_idx on public.rooms(code);
create index if not exists players_room_id_idx on public.players(room_id);
create index if not exists answers_room_round_idx on public.answers(room_id, round_number);
create index if not exists votes_room_id_idx on public.votes(room_id);
create index if not exists votes_answer_id_idx on public.votes(answer_id);
create index if not exists score_events_room_created_idx on public.score_events(room_id, created_at desc);
create index if not exists score_events_batch_idx on public.score_events(batch_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_set_updated_at on public.rooms;

create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function public.set_updated_at();

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.answers enable row level security;
alter table public.votes enable row level security;
alter table public.score_events enable row level security;

drop policy if exists "rooms are readable" on public.rooms;
drop policy if exists "players are readable" on public.players;
drop policy if exists "answers are readable" on public.answers;
drop policy if exists "votes are readable" on public.votes;
drop policy if exists "score events are readable" on public.score_events;

drop policy if exists "rooms anon readable" on public.rooms;
drop policy if exists "players anon readable" on public.players;
drop policy if exists "answers anon readable" on public.answers;
drop policy if exists "votes anon readable" on public.votes;
drop policy if exists "score events anon readable" on public.score_events;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms'
    ) then
      alter publication supabase_realtime add table public.rooms;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
    ) then
      alter publication supabase_realtime add table public.players;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'answers'
    ) then
      alter publication supabase_realtime add table public.answers;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'votes'
    ) then
      alter publication supabase_realtime add table public.votes;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'score_events'
    ) then
      alter publication supabase_realtime add table public.score_events;
    end if;
  end if;
end $$;
