export type GameMode = "initials" | "team-battle";

export type RoomPhase =
  | "lobby"
  | "countdown"
  | "playing"
  | "reveal"
  | "leaderboard"
  | "team_showing"
  | "finished";

export type VoteValue = "accept" | "reject";

export type Room = {
  id: string;
  code: string;
  host_player_id: string | null;
  game_mode: GameMode;
  target_score: number;
  phase: RoomPhase;
  current_round: number;
  initials: string | null;
  team_a: string | null;
  team_b: string | null;
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

export type RoomSnapshot = {
  room: Room;
  players: Player[];
  answers: Answer[];
  votes: Vote[];
};

export type ApiError = {
  error: string;
};
