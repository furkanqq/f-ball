import { TARGET_SCORES } from "@/lib/constants";
import {
  createRoomCode,
  isAcceptedByMajority,
  normalizeAnswer,
  normalizeNickname,
  normalizeRoomCode,
  randomInitials,
  randomMatchup,
  secondsFromNow,
} from "@/lib/game-utils";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Answer, GameMode, Player, Room, RoomSnapshot, Vote, VoteValue } from "@/lib/types";

const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;

export async function getRoomSnapshot(code: string): Promise<RoomSnapshot | null> {
  const supabase = createServerSupabaseClient();
  const normalizedCode = normalizeRoomCode(code);

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("code", normalizedCode)
    .maybeSingle<Room>();

  if (roomError) {
    throw roomError;
  }

  if (!room) {
    return null;
  }

  const [{ data: players, error: playersError }, { data: answers, error: answersError }, { data: votes, error: votesError }] =
    await Promise.all([
      supabase.from("players").select("*").eq("room_id", room.id).order("joined_at", { ascending: true }).returns<Player[]>(),
      supabase
        .from("answers")
        .select("*")
        .eq("room_id", room.id)
        .eq("round_number", room.current_round)
        .order("created_at", { ascending: true })
        .returns<Answer[]>(),
      supabase.from("votes").select("*").eq("room_id", room.id).order("created_at", { ascending: true }).returns<Vote[]>(),
    ]);

  if (playersError) {
    throw playersError;
  }

  if (answersError) {
    throw answersError;
  }

  if (votesError) {
    throw votesError;
  }

  return {
    room,
    players: players ?? [],
    answers: answers ?? [],
    votes: votes ?? [],
  };
}

export async function createRoom(nickname: string) {
  const supabase = createServerSupabaseClient();
  const cleanNickname = normalizeNickname(nickname);

  if (!cleanNickname) {
    throw new Error("Enter a nickname.");
  }

  let room: Room | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = createRoomCode();
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        code,
        game_mode: "initials",
        target_score: 10,
        phase: "lobby",
        current_round: 0,
      })
      .select("*")
      .single<Room>();

    if (!error && data) {
      room = data;
      break;
    }

    if (error && error.code !== "23505") {
      throw error;
    }
  }

  if (!room) {
    throw new Error("Could not create a unique room code.");
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({
      room_id: room.id,
      nickname: cleanNickname,
      is_host: true,
      score: 0,
    })
    .select("*")
    .single<Player>();

  if (playerError) {
    throw playerError;
  }

  const { data: updatedRoom, error: updateError } = await supabase
    .from("rooms")
    .update({ host_player_id: player.id })
    .eq("id", room.id)
    .select("*")
    .single<Room>();

  if (updateError) {
    throw updateError;
  }

  return { room: updatedRoom, player };
}

export async function joinRoom(code: string, nickname: string) {
  const supabase = createServerSupabaseClient();
  const cleanCode = normalizeRoomCode(code);
  const cleanNickname = normalizeNickname(nickname);

  if (cleanCode.length !== 6) {
    throw new Error("Enter a 6 character room code.");
  }

  if (!cleanNickname) {
    throw new Error("Enter a nickname.");
  }

  const snapshot = await getRoomSnapshot(cleanCode);

  if (!snapshot) {
    throw new Error("Room not found.");
  }

  if (snapshot.room.phase !== "lobby") {
    throw new Error("This game has already started.");
  }

  if (snapshot.players.length >= MAX_PLAYERS) {
    throw new Error("This room is full.");
  }

  const { data: player, error } = await supabase
    .from("players")
    .insert({
      room_id: snapshot.room.id,
      nickname: cleanNickname,
      is_host: false,
      score: 0,
    })
    .select("*")
    .single<Player>();

  if (error) {
    throw error;
  }

  return { room: snapshot.room, player };
}

export async function updateSettings(code: string, playerId: string, gameMode: GameMode, targetScore: number) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId);

  if (snapshot.room.phase !== "lobby") {
    throw new Error("Settings can only be changed in the lobby.");
  }

  if (!TARGET_SCORES.includes(targetScore as (typeof TARGET_SCORES)[number])) {
    throw new Error("Choose a valid target score.");
  }

  const { data, error } = await supabase
    .from("rooms")
    .update({
      game_mode: gameMode,
      target_score: targetScore,
    })
    .eq("id", snapshot.room.id)
    .select("*")
    .single<Room>();

  if (error) {
    throw error;
  }

  return data;
}

export async function startGame(code: string, playerId: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId);

  if (snapshot.players.length < MIN_PLAYERS) {
    throw new Error("A room needs at least 2 players.");
  }

  if (!["lobby", "leaderboard", "finished", "team_showing"].includes(snapshot.room.phase)) {
    throw new Error("A round is already in progress.");
  }

  const matchup = snapshot.room.game_mode === "team-battle" ? randomMatchup() : null;
  const nextRound = snapshot.room.current_round + 1;

  const { data, error } = await supabase
    .from("rooms")
    .update({
      phase: "countdown",
      current_round: nextRound,
      initials: snapshot.room.game_mode === "initials" ? randomInitials() : null,
      team_a: matchup?.teamA.name ?? null,
      team_b: matchup?.teamB.name ?? null,
      phase_ends_at: secondsFromNow(3),
      winner_player_id: null,
    })
    .eq("id", snapshot.room.id)
    .select("*")
    .single<Room>();

  if (error) {
    throw error;
  }

  return data;
}

export async function advancePhase(code: string, playerId: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId);

  if (snapshot.room.phase === "countdown") {
    const nextPhase = snapshot.room.game_mode === "initials" ? "playing" : "team_showing";
    const duration = snapshot.room.game_mode === "initials" ? 120 : 20;
    const { data, error } = await supabase
      .from("rooms")
      .update({
        phase: nextPhase,
        phase_ends_at: secondsFromNow(duration),
      })
      .eq("id", snapshot.room.id)
      .select("*")
      .single<Room>();

    if (error) {
      throw error;
    }

    return data;
  }

  if (snapshot.room.phase === "playing") {
    const { data, error } = await supabase
      .from("rooms")
      .update({
        phase: "reveal",
        phase_ends_at: null,
      })
      .eq("id", snapshot.room.id)
      .select("*")
      .single<Room>();

    if (error) {
      throw error;
    }

    return data;
  }

  throw new Error("This phase cannot be advanced.");
}

export async function submitAnswer(code: string, playerId: string, text: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requirePlayer(code, playerId);
  const cleanAnswer = normalizeAnswer(text);

  if (snapshot.room.phase !== "playing" || snapshot.room.game_mode !== "initials") {
    throw new Error("Answers are only open during the initials round.");
  }

  if (!cleanAnswer) {
    throw new Error("Enter an answer.");
  }

  const { data, error } = await supabase
    .from("answers")
    .insert({
      room_id: snapshot.room.id,
      round_number: snapshot.room.current_round,
      player_id: playerId,
      text: cleanAnswer,
      normalized_text: cleanAnswer.toLocaleLowerCase("en-US"),
    })
    .select("*")
    .single<Answer>();

  if (error?.code === "23505") {
    throw new Error("You already submitted that answer this round.");
  }

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteAnswer(code: string, playerId: string, answerId: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requirePlayer(code, playerId);

  if (snapshot.room.phase !== "playing") {
    throw new Error("Answers can only be deleted during the playing phase.");
  }

  const answer = snapshot.answers.find((item) => item.id === answerId);

  if (!answer) {
    throw new Error("Answer not found.");
  }

  if (answer.player_id !== playerId) {
    throw new Error("You can only delete your own answers.");
  }

  const { error } = await supabase.from("answers").delete().eq("id", answerId);

  if (error) {
    throw error;
  }
}

export async function castVote(code: string, playerId: string, answerId: string, vote: VoteValue) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requirePlayer(code, playerId);
  const answer = snapshot.answers.find((item) => item.id === answerId);

  if (snapshot.room.phase !== "reveal") {
    throw new Error("Voting is only open during reveal.");
  }

  if (!answer) {
    throw new Error("Answer not found.");
  }

  if (answer.player_id === playerId) {
    throw new Error("You cannot vote on your own answer.");
  }

  const { data, error } = await supabase
    .from("votes")
    .upsert(
      {
        room_id: snapshot.room.id,
        answer_id: answerId,
        voter_player_id: playerId,
        vote,
      },
      { onConflict: "answer_id,voter_player_id" },
    )
    .select("*")
    .single<Vote>();

  if (error) {
    throw error;
  }

  return data;
}

export async function finalizeRound(code: string, playerId: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId);

  if (snapshot.room.phase !== "reveal") {
    throw new Error("Round can only be finalized during reveal.");
  }

  const validCountByPlayer = new Map<string, number>();
  const validityUpdates = snapshot.answers.map(async (answer) => {
    const eligibleVoters = Math.max(snapshot.players.length - 1, 1);
    const isValid = isAcceptedByMajority(answer.id, snapshot.votes, eligibleVoters);

    if (isValid) {
      validCountByPlayer.set(answer.player_id, (validCountByPlayer.get(answer.player_id) ?? 0) + 1);
    }

    const { error } = await supabase.from("answers").update({ is_valid: isValid }).eq("id", answer.id);

    if (error) {
      throw error;
    }
  });

  await Promise.all(validityUpdates);

  const maxValid = validCountByPlayer.size > 0 ? Math.max(...validCountByPlayer.values()) : 0;
  const topPlayers = maxValid > 0 ? [...validCountByPlayer.entries()].filter(([, count]) => count === maxValid) : [];
  const roundWinners = new Set(topPlayers.length === 1 ? [topPlayers[0][0]] : []);

  const updatedPlayers = await Promise.all(
    snapshot.players.map(async (player) => {
      const hasValidAnswer = (validCountByPlayer.get(player.id) ?? 0) > 0;
      const delta = roundWinners.has(player.id) ? 1 : hasValidAnswer ? 0 : -1;
      const score = player.score + delta;
      const { data, error } = await supabase
        .from("players")
        .update({ score })
        .eq("id", player.id)
        .select("*")
        .single<Player>();

      if (error) {
        throw error;
      }

      return data;
    }),
  );

  const winner = updatedPlayers.find((player) => player.score >= snapshot.room.target_score) ?? null;
  const { data: room, error } = await supabase
    .from("rooms")
    .update({
      phase: winner ? "finished" : "leaderboard",
      winner_player_id: winner?.id ?? null,
      phase_ends_at: null,
    })
    .eq("id", snapshot.room.id)
    .select("*")
    .single<Room>();

  if (error) {
    throw error;
  }

  return { room, players: updatedPlayers };
}

export async function awardPoint(code: string, hostId: string, targetPlayerId: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, hostId);

  if (snapshot.room.phase !== "team_showing") {
    throw new Error("Points can only be awarded during team battle.");
  }

  const target = snapshot.players.find((p) => p.id === targetPlayerId);

  if (!target) {
    throw new Error("Player not found.");
  }

  const newScore = target.score + 1;
  const { error } = await supabase.from("players").update({ score: newScore }).eq("id", targetPlayerId);

  if (error) {
    throw error;
  }

  if (newScore >= snapshot.room.target_score) {
    const { error: roomError } = await supabase
      .from("rooms")
      .update({ phase: "finished", winner_player_id: targetPlayerId, phase_ends_at: null })
      .eq("id", snapshot.room.id);

    if (roomError) {
      throw roomError;
    }
  }
}

export async function generateTeamMatchup(code: string, playerId: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId);

  if (snapshot.room.game_mode !== "team-battle") {
    throw new Error("This room is not using Random Team Battle.");
  }

  const matchup = randomMatchup();
  const { data, error } = await supabase
    .from("rooms")
    .update({
      phase: "team_showing",
      team_a: matchup.teamA.name,
      team_b: matchup.teamB.name,
      phase_ends_at: secondsFromNow(20),
    })
    .eq("id", snapshot.room.id)
    .select("*")
    .single<Room>();

  if (error) {
    throw error;
  }

  return data;
}

async function requireHost(code: string, playerId: string) {
  const snapshot = await requirePlayer(code, playerId);

  if (snapshot.room.host_player_id !== playerId) {
    throw new Error("Only the host can do that.");
  }

  return snapshot;
}

async function requirePlayer(code: string, playerId: string) {
  if (!playerId) {
    throw new Error("Missing player session.");
  }

  const snapshot = await getRoomSnapshot(code);

  if (!snapshot) {
    throw new Error("Room not found.");
  }

  const player = snapshot.players.find((item) => item.id === playerId);

  if (!player) {
    throw new Error("You are not in this room.");
  }

  return snapshot;
}
