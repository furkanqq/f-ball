# Football Party Architecture

## Project Structure

```txt
app/
  api/rooms/                  Route handlers for room mutations and snapshots
  room/[code]/page.tsx        Dynamic room screen
  page.tsx                    Home create/join screen
components/
  home-page.tsx               Create and join room UI
  room-client.tsx             Lobby, game phases, voting, leaderboard
lib/
  server/room-service.ts      Supabase writes and game rules
  supabase/client.ts          Browser realtime client
  supabase/server.ts          Server Supabase client
  constants.ts                Target scores, initials, team database
  game-utils.ts               Normalization, timers, scoring helpers
  session-store.ts            Zustand persisted player session
  types.ts                    Shared TypeScript models
supabase/
  schema.sql                  Tables, constraints, RLS, realtime publication
```

## Database Schema

```mermaid
erDiagram
  rooms ||--o{ players : contains
  rooms ||--o{ answers : has
  rooms ||--o{ votes : has
  players ||--o{ answers : submits
  players ||--o{ votes : casts
  answers ||--o{ votes : receives

  rooms {
    uuid id PK
    text code UK
    uuid host_player_id FK
    game_mode game_mode
    integer target_score
    room_phase phase
    integer current_round
    text initials
    text team_a
    text team_b
    timestamptz phase_ends_at
    uuid winner_player_id FK
  }

  players {
    uuid id PK
    uuid room_id FK
    text nickname
    boolean is_host
    integer score
  }

  answers {
    uuid id PK
    uuid room_id FK
    integer round_number
    uuid player_id FK
    text text
    text normalized_text
    boolean is_valid
  }

  votes {
    uuid id PK
    uuid room_id FK
    uuid answer_id FK
    uuid voter_player_id FK
    vote_value vote
  }
```

## Realtime Flow

```mermaid
sequenceDiagram
  participant Client
  participant API as Next.js Route Handler
  participant DB as Supabase Postgres
  participant RT as Supabase Realtime

  Client->>API: POST/PATCH action with playerId
  API->>DB: Validate room/player/host and write rows
  DB-->>RT: Publish row changes
  RT-->>Client: rooms/players/answers/votes change event
  Client->>API: GET room snapshot
  API->>DB: Read room, players, answers, votes
  API-->>Client: Render synchronized state
```

## Implementation Plan

1. Create room and join room APIs with 6 character codes and persisted browser player sessions.
2. Build lobby UI with player list, host badge, game mode selection, and target score controls.
3. Add Supabase Realtime subscriptions for all room tables and snapshot refresh on changes.
4. Implement Footballer Initials Challenge phases: countdown, timed answer entry, reveal, voting, scoring, leaderboard, winner.
5. Implement Random Team Battle phases: countdown, synchronized team matchup, 20 second display, generate new matchup.
6. Keep all writes in route handlers so game-rule checks are centralized for the MVP.
