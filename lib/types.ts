export type GameMode = "initials" | "team-battle" | "imposter" | "five-teams";

export type RoomPhase =
  | "lobby"
  | "countdown"
  | "playing"
  | "reveal"
  | "leaderboard"
  | "team_showing"
  | "imposter"
  | "finished";

export type VoteValue = "accept" | "reject";

export type Room = {
  id: string;
  code: string;
  host_player_id: string | null;
  game_mode: GameMode;
  target_score: number;
  five_team_seconds?: number | null;
  phase: RoomPhase;
  current_round: number;
  initials: string | null;
  team_a: string | null;
  team_b: string | null;
  imposter_player_id: string | null;
  imposter_player_name: string | null;
  imposter_clue: string | null;
  phase_ends_at: string | null;
  winner_player_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Player = {
  id: string;
  room_id: string;
  nickname: string;
  is_host: boolean;
  score: number;
  session_token_hash?: string;
  joined_at: string;
};

export type Answer = {
  id: string;
  room_id: string;
  round_number: number;
  player_id: string;
  text: string;
  normalized_text: string;
  is_valid: boolean | null;
  created_at: string;
};

export type Vote = {
  id: string;
  room_id: string;
  answer_id: string;
  voter_player_id: string;
  vote: VoteValue;
  created_at: string;
};

export type ScoreEventReason = "initials-finalize" | "team-battle-award" | "five-teams-manual";

export type ScoreEvent = {
  id: string;
  batch_id: string;
  room_id: string;
  round_number: number;
  game_mode: GameMode;
  player_id: string;
  delta: number;
  reason: ScoreEventReason;
  created_by_player_id: string | null;
  created_at: string;
  undone_at: string | null;
  undone_by_player_id: string | null;
};

export type RoomSnapshot = {
  room: Room;
  players: Player[];
  answers: Answer[];
  votes: Vote[];
  scoreEvents: ScoreEvent[];
};

export type ApiError = {
  error: string;
};
