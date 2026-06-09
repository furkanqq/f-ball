import {
  COUNTDOWN_PHASE_SECONDS,
  DEFAULT_FIVE_TEAM_SECONDS,
  FIVE_TEAM_COUNT,
  FIVE_TEAM_ROUNDS,
  MAX_FIVE_TEAM_SECONDS,
  MIN_FIVE_TEAM_SECONDS,
  TARGET_SCORES,
} from "@/lib/constants";
import { createHash, randomBytes } from "crypto";
import {
  createRoomCode,
  encodeTeamSet,
  isAcceptedByMajority,
  normalizeAnswer,
  normalizeNickname,
  normalizeRoomCode,
  randomInitials,
  randomMatchup,
  randomTeamSet,
  secondsFromNow,
} from "@/lib/game-utils";
import { randomImposterPick } from "@/lib/server/players";
import {
  shouldIncludeClientAnswers,
  shouldIncludeClientVotes,
  shouldLimitClientAnswersToPlayer,
} from "@/lib/snapshot-scope";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Answer, GameMode, Player, Room, RoomSnapshot, ScoreEvent, ScoreEventReason, Vote, VoteValue } from "@/lib/types";

const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const PUBLIC_PLAYER_COLUMNS = "id,room_id,nickname,is_host,score,joined_at";
const PRIVATE_PLAYER_COLUMNS = `${PUBLIC_PLAYER_COLUMNS},session_token_hash`;

type ManualScore = {
  playerId: string;
  points: number;
};

type ScoreDelta = {
  playerId: string;
  delta: number;
};

type RoomSnapshotOptions = {
  scope?: "full" | "client";
  playerId?: string | null;
  sessionToken?: string | null;
};

export async function getRoomSnapshot(code: string, options: RoomSnapshotOptions = {}): Promise<RoomSnapshot | null> {
  const supabase = createServerSupabaseClient();
  const normalizedCode = normalizeRoomCode(code);
  const scope = options.scope ?? "full";

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

  const includeAnswers = scope === "full" || shouldIncludeClientAnswers(room.phase, room.game_mode);
  const includeVotes = scope === "full" || shouldIncludeClientVotes(room.phase, room.game_mode);
  const limitAnswersToPlayer = scope === "client" && shouldLimitClientAnswersToPlayer(room.phase);
  const shouldQueryAnswers = includeAnswers && (!limitAnswersToPlayer || Boolean(options.playerId));
  const playerColumns = scope === "client" ? PUBLIC_PLAYER_COLUMNS : PRIVATE_PLAYER_COLUMNS;

  let answersQuery = supabase
    .from("answers")
    .select("*")
    .eq("room_id", room.id)
    .eq("round_number", room.current_round)
    .order("created_at", { ascending: true });

  if (limitAnswersToPlayer && options.playerId) {
    answersQuery = answersQuery.eq("player_id", options.playerId);
  }

  const [{ data: players, error: playersError }, answersResult, { data: scoreEvents, error: scoreEventsError }] = await Promise.all([
    supabase
      .from("players")
      .select(playerColumns)
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true })
      .returns<Player[]>(),
    shouldQueryAnswers ? answersQuery.returns<Answer[]>() : Promise.resolve({ data: [] as Answer[], error: null }),
    supabase
      .from("score_events")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: false })
      .limit(80)
      .returns<ScoreEvent[]>(),
  ]);

  if (playersError) {
    throw playersError;
  }

  if (scope === "client" && options.playerId) {
    await assertPlayerSession(room.id, options.playerId, options.sessionToken);
  }

  const { data: answers, error: answersError } = answersResult;

  if (answersError) {
    throw answersError;
  }

  if (scoreEventsError) {
    throw scoreEventsError;
  }

  const answerIds = (answers ?? []).map((answer) => answer.id);
  const { data: votes, error: votesError } =
    includeVotes && answerIds.length > 0
      ? await supabase
          .from("votes")
          .select("*")
          .eq("room_id", room.id)
          .in("answer_id", answerIds)
          .order("created_at", { ascending: true })
          .returns<Vote[]>()
      : { data: [] as Vote[], error: null };

  if (votesError) {
    throw votesError;
  }

  return {
    room,
    players: players ?? [],
    answers: answers ?? [],
    votes: votes ?? [],
    scoreEvents: scoreEvents ?? [],
  };
}

export async function createRoom(nickname: string) {
  const supabase = createServerSupabaseClient();
  const cleanNickname = normalizeNickname(nickname);
  const sessionToken = createSessionToken();

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
      session_token_hash: hashSessionToken(sessionToken),
    })
    .select(PRIVATE_PLAYER_COLUMNS)
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

  return { room: updatedRoom, player: toPublicPlayer(player), sessionToken };
}

export async function joinRoom(code: string, nickname: string) {
  const supabase = createServerSupabaseClient();
  const cleanCode = normalizeRoomCode(code);
  const cleanNickname = normalizeNickname(nickname);
  const sessionToken = createSessionToken();

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
      session_token_hash: hashSessionToken(sessionToken),
    })
    .select(PRIVATE_PLAYER_COLUMNS)
    .single<Player>();

  if (error) {
    throw error;
  }

  return { room: snapshot.room, player: toPublicPlayer(player), sessionToken };
}

export async function updateSettings(
  code: string,
  playerId: string,
  sessionToken: string,
  gameMode: GameMode,
  targetScore: number,
  fiveTeamSeconds?: number,
) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId, sessionToken);

  if (snapshot.room.phase !== "lobby") {
    throw new Error("Settings can only be changed in the lobby.");
  }

  if (!TARGET_SCORES.includes(targetScore as (typeof TARGET_SCORES)[number])) {
    throw new Error("Choose a valid target score.");
  }

  const shouldUpdateFiveTeamSeconds = gameMode === "five-teams" || fiveTeamSeconds !== undefined;
  const cleanFiveTeamSeconds = shouldUpdateFiveTeamSeconds
    ? normalizeFiveTeamSeconds(fiveTeamSeconds ?? snapshot.room.five_team_seconds ?? DEFAULT_FIVE_TEAM_SECONDS)
    : null;

  const { data, error } = await supabase
    .from("rooms")
    .update({
      game_mode: gameMode,
      target_score: targetScore,
      ...(cleanFiveTeamSeconds === null ? {} : { five_team_seconds: cleanFiveTeamSeconds }),
    })
    .eq("id", snapshot.room.id)
    .select("*")
    .single<Room>();

  if (error) {
    throw error;
  }

  return data;
}

export async function startGame(code: string, playerId: string, sessionToken: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId, sessionToken);

  const minPlayers = snapshot.room.game_mode === "imposter" ? 3 : MIN_PLAYERS;

  if (snapshot.players.length < minPlayers) {
    throw new Error(
      snapshot.room.game_mode === "imposter"
        ? "Imposter mode requires at least 3 players."
        : "A room needs at least 2 players.",
    );
  }

  if (!["lobby", "leaderboard", "finished", "team_showing", "imposter"].includes(snapshot.room.phase)) {
    throw new Error("A round is already in progress.");
  }

  if (snapshot.room.game_mode === "five-teams" && snapshot.room.current_round >= FIVE_TEAM_ROUNDS) {
    return finishFiveTeamGame(snapshot);
  }

  const nextRound = snapshot.room.current_round + 1;

  if (snapshot.room.game_mode === "imposter") {
    const { playerName, clue } = randomImposterPick();
    const imposterPlayer = snapshot.players[Math.floor(Math.random() * snapshot.players.length)];

    const { data, error } = await supabase
      .from("rooms")
      .update({
        phase: "imposter",
        current_round: nextRound,
        imposter_player_id: imposterPlayer.id,
        imposter_player_name: playerName,
        imposter_clue: clue,
        initials: null,
        team_a: null,
        team_b: null,
        phase_ends_at: null,
        winner_player_id: null,
      })
      .eq("id", snapshot.room.id)
      .select("*")
      .single<Room>();

    if (error) throw error;
    return data;
  }

  if (snapshot.room.game_mode === "five-teams") {
    const teamSet = randomTeamSet(FIVE_TEAM_COUNT);
    const { data, error } = await supabase
      .from("rooms")
      .update({
        phase: "countdown",
        current_round: nextRound,
        initials: null,
        team_a: encodeTeamSet(teamSet.map((team) => team.name)),
        team_b: null,
        imposter_player_id: null,
        imposter_player_name: null,
        imposter_clue: null,
        phase_ends_at: secondsFromNow(COUNTDOWN_PHASE_SECONDS),
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

  const matchup = snapshot.room.game_mode === "team-battle" ? randomMatchup() : null;

  const { data, error } = await supabase
    .from("rooms")
    .update({
      phase: "countdown",
      current_round: nextRound,
      initials: snapshot.room.game_mode === "initials" ? randomInitials() : null,
      team_a: matchup?.teamA.name ?? null,
      team_b: matchup?.teamB.name ?? null,
      imposter_player_id: null,
      imposter_player_name: null,
      imposter_clue: null,
      phase_ends_at: secondsFromNow(COUNTDOWN_PHASE_SECONDS),
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

export async function advancePhase(code: string, playerId: string, sessionToken: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId, sessionToken);

  if (snapshot.room.phase === "countdown") {
    const nextPhase = snapshot.room.game_mode === "team-battle" ? "team_showing" : "playing";
    const duration =
      snapshot.room.game_mode === "initials"
        ? 120
        : snapshot.room.game_mode === "five-teams"
          ? normalizeFiveTeamSeconds(snapshot.room.five_team_seconds ?? DEFAULT_FIVE_TEAM_SECONDS)
          : 20;
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

  if (snapshot.room.phase === "playing" && (snapshot.room.game_mode === "initials" || snapshot.room.game_mode === "five-teams")) {
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

export async function submitAnswer(code: string, playerId: string, sessionToken: string, text: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requirePlayer(code, playerId, sessionToken);
  const cleanAnswer = normalizeAnswer(text);

  if (snapshot.room.phase !== "playing" || !["initials", "five-teams"].includes(snapshot.room.game_mode)) {
    throw new Error("Answers are only open during the playing phase.");
  }

  if (!cleanAnswer) {
    throw new Error("Enter an answer.");
  }

  if (snapshot.room.game_mode === "five-teams") {
    const existingAnswer = snapshot.answers.find((answer) => answer.player_id === playerId);

    if (existingAnswer) {
      const { data, error } = await supabase
        .from("answers")
        .update({
          text: cleanAnswer,
          normalized_text: cleanAnswer.toLocaleLowerCase("en-US"),
          is_valid: null,
        })
        .eq("id", existingAnswer.id)
        .select("*")
        .single<Answer>();

      if (error?.code === "23505") {
        throw new Error("That answer is already used this round.");
      }

      if (error) {
        throw error;
      }

      return data;
    }
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

export async function deleteAnswer(code: string, playerId: string, sessionToken: string, answerId: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requirePlayer(code, playerId, sessionToken);

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

export async function castVote(code: string, playerId: string, sessionToken: string, answerId: string, vote: VoteValue) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requirePlayer(code, playerId, sessionToken);
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

export async function finalizeRound(code: string, playerId: string, sessionToken: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId, sessionToken);

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

  const scoreUpdates = await Promise.all(
    snapshot.players.map(async (player) => {
      const hasValidAnswer = (validCountByPlayer.get(player.id) ?? 0) > 0;
      const delta = roundWinners.has(player.id) ? 1 : hasValidAnswer ? 0 : -1;
      const score = Math.max(0, player.score + delta);
      const { data, error } = await supabase
        .from("players")
        .update({ score })
        .eq("id", player.id)
        .select("*")
        .single<Player>();

      if (error) {
        throw error;
      }

      return { player: data, delta: data.score - player.score };
    }),
  );
  const updatedPlayers = scoreUpdates.map((update) => update.player);

  await recordScoreEvents(
    snapshot,
    playerId,
    "initials-finalize",
    scoreUpdates.map((update) => ({ playerId: update.player.id, delta: update.delta })),
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

export async function awardPoint(code: string, hostId: string, sessionToken: string, targetPlayerId: string, points = 1) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, hostId, sessionToken);

  if (snapshot.room.phase !== "team_showing") {
    throw new Error("Points can only be awarded during team battle.");
  }

  const target = snapshot.players.find((p) => p.id === targetPlayerId);

  if (!target) {
    throw new Error("Player not found.");
  }

  const newScore = target.score + points;
  const { error } = await supabase.from("players").update({ score: newScore }).eq("id", targetPlayerId);

  if (error) {
    throw error;
  }

  await recordScoreEvents(snapshot, hostId, "team-battle-award", [{ playerId: targetPlayerId, delta: points }]);

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

export async function awardFiveTeamScores(code: string, hostId: string, sessionToken: string, scores: ManualScore[]) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, hostId, sessionToken);

  if (snapshot.room.phase !== "reveal" || snapshot.room.game_mode !== "five-teams") {
    throw new Error("Manual scores can only be saved during Five Teams reveal.");
  }

  const scoreByPlayer = new Map<string, number>();

  for (const score of scores) {
    const points = Math.trunc(Number(score.points));

    if (!snapshot.players.some((player) => player.id === score.playerId)) {
      throw new Error("Player not found.");
    }

    if (!Number.isFinite(points) || points < 0 || points > FIVE_TEAM_COUNT) {
      throw new Error(`Scores must be between 0 and ${FIVE_TEAM_COUNT}.`);
    }

    scoreByPlayer.set(score.playerId, points);
  }

  const scoreUpdates = await Promise.all(
    snapshot.players.map(async (player) => {
      const score = player.score + (scoreByPlayer.get(player.id) ?? 0);
      const { data, error } = await supabase.from("players").update({ score }).eq("id", player.id).select("*").single<Player>();

      if (error) {
        throw error;
      }

      return { player: data, delta: data.score - player.score };
    }),
  );
  const updatedPlayers = scoreUpdates.map((update) => update.player);

  await recordScoreEvents(
    snapshot,
    hostId,
    "five-teams-manual",
    scoreUpdates.map((update) => ({ playerId: update.player.id, delta: update.delta })),
  );

  const finished = snapshot.room.current_round >= FIVE_TEAM_ROUNDS;
  const winner = finished ? getSingleLeader(updatedPlayers) : null;
  const { error } = await supabase
    .from("rooms")
    .update({
      phase: finished ? "finished" : "leaderboard",
      winner_player_id: winner?.id ?? null,
      phase_ends_at: null,
    })
    .eq("id", snapshot.room.id);

  if (error) {
    throw error;
  }

  return { players: updatedPlayers, winner };
}

export async function generateTeamMatchup(code: string, playerId: string, sessionToken: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, playerId, sessionToken);

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

export async function undoScoreBatch(code: string, hostId: string, sessionToken: string, batchId?: string) {
  const supabase = createServerSupabaseClient();
  const snapshot = await requireHost(code, hostId, sessionToken);
  const targetBatchId = batchId ?? snapshot.scoreEvents.find((event) => !event.undone_at)?.batch_id;

  if (!targetBatchId) {
    throw new Error("No score change to undo.");
  }

  const { data: events, error: eventsError } = await supabase
    .from("score_events")
    .select("*")
    .eq("room_id", snapshot.room.id)
    .eq("batch_id", targetBatchId)
    .is("undone_at", null)
    .returns<ScoreEvent[]>();

  if (eventsError) {
    throw eventsError;
  }

  if (!events?.length) {
    throw new Error("That score change was already undone.");
  }

  const updatedPlayers = await Promise.all(
    events.map(async (event) => {
      const player = snapshot.players.find((item) => item.id === event.player_id);

      if (!player) {
        throw new Error("Player not found.");
      }

      const score = Math.max(0, player.score - event.delta);
      const { data, error } = await supabase.from("players").update({ score }).eq("id", player.id).select("*").single<Player>();

      if (error) {
        throw error;
      }

      return data;
    }),
  );

  const { error: undoError } = await supabase
    .from("score_events")
    .update({
      undone_at: new Date().toISOString(),
      undone_by_player_id: hostId,
    })
    .eq("room_id", snapshot.room.id)
    .eq("batch_id", targetBatchId);

  if (undoError) {
    throw undoError;
  }

  const playerById = new Map(snapshot.players.map((player) => [player.id, player]));

  for (const player of updatedPlayers) {
    playerById.set(player.id, player);
  }

  const players = [...playerById.values()];
  const winner = getWinnerForMode(snapshot.room.game_mode, players, snapshot.room.target_score);

  if (snapshot.room.phase === "finished" || snapshot.room.winner_player_id) {
    const { error } = await supabase
      .from("rooms")
      .update({
        phase: winner ? "finished" : "leaderboard",
        winner_player_id: winner?.id ?? null,
      })
      .eq("id", snapshot.room.id);

    if (error) {
      throw error;
    }
  }

  return { ok: true };
}

async function requireHost(code: string, playerId: string, sessionToken: string) {
  const snapshot = await requirePlayer(code, playerId, sessionToken);

  if (snapshot.room.host_player_id !== playerId) {
    throw new Error("Only the host can do that.");
  }

  return snapshot;
}

async function requirePlayer(code: string, playerId: string, sessionToken: string) {
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

  assertValidSessionToken(player, sessionToken);

  return snapshot;
}

async function assertPlayerSession(roomId: string, playerId: string, sessionToken?: string | null) {
  if (!sessionToken) {
    throw new Error("Missing player session.");
  }

  const supabase = createServerSupabaseClient();
  const { data: player, error } = await supabase
    .from("players")
    .select("id,room_id,nickname,is_host,score,joined_at,session_token_hash")
    .eq("id", playerId)
    .eq("room_id", roomId)
    .maybeSingle<Player>();

  if (error) {
    throw error;
  }

  if (!player) {
    throw new Error("You are not in this room.");
  }

  assertValidSessionToken(player, sessionToken);
}

function assertValidSessionToken(player: Player, sessionToken: string) {
  if (!player.session_token_hash || !sessionToken || hashSessionToken(sessionToken) !== player.session_token_hash) {
    throw new Error("Invalid player session.");
  }
}

function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function toPublicPlayer(player: Player): Player {
  return {
    id: player.id,
    room_id: player.room_id,
    nickname: player.nickname,
    is_host: player.is_host,
    score: player.score,
    joined_at: player.joined_at,
  };
}

async function recordScoreEvents(
  snapshot: RoomSnapshot,
  createdByPlayerId: string,
  reason: ScoreEventReason,
  deltas: ScoreDelta[],
) {
  const events = deltas.filter((delta) => delta.delta !== 0);

  if (!events.length) {
    return;
  }

  const supabase = createServerSupabaseClient();
  const batchId = crypto.randomUUID();
  const { error } = await supabase.from("score_events").insert(
    events.map((event) => ({
      batch_id: batchId,
      room_id: snapshot.room.id,
      round_number: snapshot.room.current_round,
      game_mode: snapshot.room.game_mode,
      player_id: event.playerId,
      delta: event.delta,
      reason,
      created_by_player_id: createdByPlayerId,
    })),
  );

  if (error) {
    throw error;
  }
}

async function finishFiveTeamGame(snapshot: RoomSnapshot) {
  const supabase = createServerSupabaseClient();
  const winner = getSingleLeader(snapshot.players);
  const { data, error } = await supabase
    .from("rooms")
    .update({
      phase: "finished",
      winner_player_id: winner?.id ?? null,
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

function getSingleLeader(players: Player[]) {
  const sorted = [...players].sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));
  const leader = sorted[0] ?? null;

  if (!leader || sorted[1]?.score === leader.score) {
    return null;
  }

  return leader;
}

function getWinnerForMode(gameMode: GameMode, players: Player[], targetScore: number) {
  if (gameMode === "five-teams") {
    return getSingleLeader(players);
  }

  return players.find((player) => player.score >= targetScore) ?? null;
}

function normalizeFiveTeamSeconds(value: number) {
  const seconds = Math.trunc(Number(value));

  if (!Number.isFinite(seconds) || seconds < MIN_FIVE_TEAM_SECONDS || seconds > MAX_FIVE_TEAM_SECONDS) {
    throw new Error(`Five Teams time must be between ${MIN_FIVE_TEAM_SECONDS} and ${MAX_FIVE_TEAM_SECONDS} seconds.`);
  }

  return seconds;
}
