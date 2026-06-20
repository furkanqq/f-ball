"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Copy, Loader2, Trash2 } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { CountdownTimer, PhaseAutoAdvance } from "@/components/room/phase-timer";
import {
  Countdown,
  FiveTeamsPlaying,
  FiveTeamsReveal,
  ImposterPhase,
  InitialsPlaying,
  LeaderboardPanel,
  Lobby,
  PhaseBadge,
  PlayerList,
  Reveal,
  RoomShell,
  ScoreHistory,
  Scoreboard,
  TeamBattle,
} from "@/components/room/room-panels";
import { useDebouncedCallback } from "@/components/room/use-debounced-callback";
import { COUNTDOWN_DISPLAY_SECONDS, FIVE_TEAM_COUNT, FIVE_TEAM_ROUNDS } from "@/lib/constants";
import { useTranslation } from "@/lib/language-store";
import { useSessionStore } from "@/lib/session-store";
import { shouldIncludeClientAnswers, shouldIncludeClientVotes } from "@/lib/snapshot-scope";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { Answer, ApiError, RoomSnapshot } from "@/lib/types";

type RoomClientProps = {
  code: string;
};

type ActionState = {
  busy: string;
  error: string;
};

export function RoomClient({ code }: RoomClientProps) {
  const t = useTranslation();
  const router = useRouter();
  const { playerId, roomCode, sessionToken, clearSession } = useSessionStore();
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [optimisticAnswers, setOptimisticAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActionState>({ busy: "", error: "" });
  const hadLoadedRoomRef = useRef(false);

  const loadSnapshot = useCallback(async () => {
    const params = new URLSearchParams();

    if (playerId) {
      params.set("playerId", playerId);
    }

    const query = params.size > 0 ? `?${params.toString()}` : "";
    const response = await fetch(`/api/rooms/${code}/snapshot${query}`, {
      cache: "no-store",
      headers: sessionToken ? { "x-fball-session-token": sessionToken } : undefined,
    });
    const data = (await response.json()) as RoomSnapshot | ApiError;

    if ("error" in data) {
      if (response.status === 404 && (hadLoadedRoomRef.current || roomCode === code)) {
        clearSession();
        setSnapshot(null);
        setLoading(false);
        router.replace("/");
        return;
      }

      setAction((current) => ({ ...current, error: data.error }));
    } else {
      hadLoadedRoomRef.current = true;
      setSnapshot(data);
      setAction((current) => ({ ...current, error: "" }));
    }

    setLoading(false);
  }, [clearSession, code, playerId, roomCode, router, sessionToken]);

  const { cancel: cancelRealtimeSnapshot, run: scheduleRealtimeSnapshot } = useDebouncedCallback(loadSnapshot, 250);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadSnapshot(), 0);

    return () => window.clearTimeout(timer);
  }, [loadSnapshot]);

  useEffect(() => {
    if (!snapshot?.room.id) {
      return;
    }

    const supabase = createBrowserSupabaseClient();
    const poll = window.setInterval(() => void loadSnapshot(), supabase ? 15000 : 4000);

    if (!supabase) {
      return () => window.clearInterval(poll);
    }

    const includeAnswers = shouldIncludeClientAnswers(snapshot.room.phase, snapshot.room.game_mode);
    const includeVotes = shouldIncludeClientVotes(snapshot.room.phase, snapshot.room.game_mode);
    const channel = supabase
      .channel(`room-${snapshot.room.id}-${snapshot.room.phase}-${snapshot.room.game_mode}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${snapshot.room.id}` }, () =>
        scheduleRealtimeSnapshot(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${snapshot.room.id}` },
        () => scheduleRealtimeSnapshot(),
      );

    if (includeAnswers) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${snapshot.room.id}` },
        () => scheduleRealtimeSnapshot(),
      );
    }

    if (includeVotes) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${snapshot.room.id}` },
        () => scheduleRealtimeSnapshot(),
      );
    }

    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table: "score_events", filter: `room_id=eq.${snapshot.room.id}` },
      () => scheduleRealtimeSnapshot(),
    );

    channel.subscribe();

    return () => {
      window.clearInterval(poll);
      cancelRealtimeSnapshot();
      void supabase.removeChannel(channel);
    };
  }, [
    cancelRealtimeSnapshot,
    loadSnapshot,
    scheduleRealtimeSnapshot,
    snapshot?.room.game_mode,
    snapshot?.room.id,
    snapshot?.room.phase,
  ]);

  const isHost = Boolean(playerId && snapshot?.room.host_player_id === playerId);
  const currentPlayer = snapshot?.players.find((player) => player.id === playerId) ?? null;
  const activeCode = snapshot?.room.code ?? code;
  const isSessionForRoom = roomCode === activeCode && Boolean(currentPlayer) && Boolean(sessionToken);
  const visibleSnapshot = useMemo(() => {
    if (!snapshot || optimisticAnswers.length === 0) {
      return snapshot;
    }

    const answerIds = new Set(snapshot.answers.map((answer) => answer.id));
    const mergedAnswers = [
      ...snapshot.answers,
      ...optimisticAnswers.filter(
        (answer) =>
          answer.room_id === snapshot.room.id &&
          answer.round_number === snapshot.room.current_round &&
          !answerIds.has(answer.id),
      ),
    ];

    return { ...snapshot, answers: mergedAnswers };
  }, [optimisticAnswers, snapshot]);

  const leaderboard = useMemo(
    () => [...(snapshot?.players ?? [])].sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at)),
    [snapshot?.players],
  );

  const postAction = useCallback(async (path: string, body: Record<string, unknown>, busy: string, method?: string) => {
    setAction({ busy, error: "" });
    const response = await fetch(path, {
      method: method ?? (path.includes("/settings") ? "PATCH" : "POST"),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(playerId ? { ...body, sessionToken } : body),
    });
    const data = (await response.json()) as ApiError | unknown;

    if (response.ok) {
      await loadSnapshot();
      setAction({ busy: "", error: "" });
      return data;
    }

    setAction({ busy: "", error: "error" in (data as ApiError) ? (data as ApiError).error : "Action failed." });
    return false;
  }, [loadSnapshot, playerId, sessionToken]);

  const phaseKey = snapshot ? `${snapshot.room.id}:${snapshot.room.current_round}:${snapshot.room.phase}` : "";
  const shouldAutoAdvance =
    Boolean(snapshot && isHost && snapshot.room.phase_ends_at) &&
    (snapshot?.room.phase === "countdown" || snapshot?.room.phase === "playing");

  async function copyCode() {
    await navigator.clipboard?.writeText(activeCode);
  }

  async function closeRoom() {
    if (!playerId || !window.confirm(t.room.closeRoomConfirm)) {
      return;
    }

    setAction({ busy: "close-room", error: "" });
    const response = await fetch(`/api/rooms/${activeCode}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId, sessionToken }),
    });
    const data = (await response.json()) as ApiError | { ok: true };

    if (response.ok) {
      clearSession();
      router.replace("/");
      return;
    }

    setAction({ busy: "", error: "error" in data ? data.error : "Action failed." });
  }

  async function submitAnswer(text: string, onSuccess: () => void) {
    if (!text.trim() || !playerId) {
      return;
    }

    const result = await postAction(`/api/rooms/${activeCode}/answers`, { playerId, text }, "answer");

    if (result && typeof result === "object" && "answer" in result) {
      setOptimisticAnswers((current) => {
        const answer = (result as { answer: Answer }).answer;
        return [...current.filter((item) => item.id !== answer.id), answer];
      });
      onSuccess();
    }
  }

  async function deleteAnswer(answerId: string) {
    await postAction(`/api/rooms/${activeCode}/answers`, { playerId, answerId }, `delete-${answerId}`, "DELETE");
  }

  if (loading) {
    return (
      <RoomShell>
        <div className="flex min-h-[70vh] items-center justify-center text-emerald-100">
          <Loader2 className="mr-3 animate-spin" />
          {t.room.loading}
        </div>
      </RoomShell>
    );
  }

  if (!snapshot) {
    return (
      <RoomShell>
        <div className="mx-auto max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center">
          <h1 className="text-2xl font-black">{t.room.unavailableTitle}</h1>
          <p className="mt-2 text-zinc-300">{action.error || t.room.unavailableFallback}</p>
          <Link className="mt-5 inline-flex rounded-md bg-emerald-400 px-4 py-3 font-bold text-emerald-950" href="/">
            {t.common.backHome}
          </Link>
        </div>
      </RoomShell>
    );
  }

  return (
    <RoomShell>
      <PhaseAutoAdvance
        active={shouldAutoAdvance}
        phaseKey={phaseKey}
        phaseEndsAt={snapshot.room.phase_ends_at}
        onAdvance={() => {
          void postAction(`/api/rooms/${activeCode}/advance`, { playerId }, "advance");
        }}
      />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-white/10 bg-black/25 px-3 py-3 backdrop-blur sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link className="text-xs font-semibold text-emerald-300 sm:text-sm" href="/">
                <Image
                  src="/logo/horizontal-logo.png"
                  alt={t.common.brand}
                  width={132}
                  height={52}
                  priority
                  className="h-10 w-auto object-contain sm:h-12"
                />
              </Link>
              <h1 className="text-lg font-black text-white sm:text-3xl">
                {t.room.room} <span className="font-mono text-emerald-300">{activeCode}</span>
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                onClick={copyCode}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.05] px-2.5 text-xs font-bold text-white transition hover:bg-white/[0.1] sm:h-11 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Copy size={14} />
                <span className="hidden sm:inline">{t.room.copyCode}</span>
              </button>
              {isHost ? (
                <button
                  onClick={closeRoom}
                  disabled={Boolean(action.busy)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md border border-red-300/30 bg-red-500/10 px-2.5 text-xs font-bold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11 sm:gap-2 sm:px-4 sm:text-sm"
                >
                  {action.busy === "close-room" ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  <span className="hidden sm:inline">{t.room.closeRoom}</span>
                </button>
              ) : null}
              <PhaseBadge phase={snapshot.room.phase} />
              <LanguageToggle />
            </div>
          </div>
        </header>

        {action.error ? (
          <div className="rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{action.error}</div>
        ) : null}

        {!isSessionForRoom ? (
          <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50">
            {t.room.notJoined}
          </div>
        ) : null}

        <div className="grid gap-4 lg:gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 order-last lg:order-none">
            {snapshot.room.phase === "lobby" ? (
              <Lobby
                snapshot={snapshot}
                isHost={isHost}
                busy={action.busy}
                onSettings={(gameMode, targetScore, fiveTeamSeconds) =>
                  postAction(
                    `/api/rooms/${activeCode}/settings`,
                    { playerId, gameMode, targetScore, fiveTeamSeconds },
                    `settings-${gameMode}-${targetScore}-${fiveTeamSeconds ?? ""}`,
                  )
                }
                onStart={() => postAction(`/api/rooms/${activeCode}/start`, { playerId }, "start")}
              />
            ) : null}

            {snapshot.room.phase === "countdown" ? (
              <CountdownTimer phaseEndsAt={snapshot.room.phase_ends_at} maxSeconds={COUNTDOWN_DISPLAY_SECONDS}>
                {(secondsLeft) => <Countdown snapshot={snapshot} secondsLeft={secondsLeft} />}
              </CountdownTimer>
            ) : null}

            {snapshot.room.phase === "playing" && snapshot.room.game_mode === "initials" ? (
              <CountdownTimer phaseEndsAt={snapshot.room.phase_ends_at}>
                {(secondsLeft) => (
                  <InitialsPlaying
                    snapshot={visibleSnapshot ?? snapshot}
                    currentPlayerId={playerId}
                    secondsLeft={secondsLeft}
                    isHost={isHost}
                    busy={action.busy}
                    onSubmitAnswer={submitAnswer}
                    onDeleteAnswer={deleteAnswer}
                    onEndRound={() => postAction(`/api/rooms/${activeCode}/advance`, { playerId }, "advance")}
                  />
                )}
              </CountdownTimer>
            ) : null}

            {snapshot.room.phase === "playing" && snapshot.room.game_mode === "five-teams" ? (
              <CountdownTimer phaseEndsAt={snapshot.room.phase_ends_at}>
                {(secondsLeft) => (
                  <FiveTeamsPlaying
                    snapshot={visibleSnapshot ?? snapshot}
                    currentPlayerId={playerId}
                    secondsLeft={secondsLeft}
                    busy={action.busy}
                    onSubmitAnswer={submitAnswer}
                    onDeleteAnswer={deleteAnswer}
                  />
                )}
              </CountdownTimer>
            ) : null}

            {snapshot.room.phase === "reveal" && snapshot.room.game_mode === "initials" ? (
              <Reveal
                snapshot={visibleSnapshot ?? snapshot}
                currentPlayerId={playerId}
                isHost={isHost}
                busy={action.busy}
                onVote={(answerId, vote) => postAction(`/api/rooms/${activeCode}/votes`, { playerId, answerId, vote }, answerId)}
                onFinalize={() => postAction(`/api/rooms/${activeCode}/finalize`, { playerId }, "finalize")}
              />
            ) : null}

            {snapshot.room.phase === "reveal" && snapshot.room.game_mode === "five-teams" ? (
              <FiveTeamsReveal
                snapshot={visibleSnapshot ?? snapshot}
                isHost={isHost}
                busy={action.busy}
                onScoreRound={(scores) => postAction(`/api/rooms/${activeCode}/score`, { playerId, scores }, "score-round")}
              />
            ) : null}

            {snapshot.room.phase === "leaderboard" || snapshot.room.phase === "finished" ? (
              <LeaderboardPanel
                snapshot={snapshot}
                isHost={isHost}
                busy={action.busy}
                onNextRound={() => postAction(`/api/rooms/${activeCode}/start`, { playerId }, "start")}
              />
            ) : null}

            {snapshot.room.phase === "imposter" ? (
              <ImposterPhase
                snapshot={snapshot}
                currentPlayerId={playerId}
                isHost={isHost}
                busy={action.busy}
                onNewRound={() => postAction(`/api/rooms/${activeCode}/start`, { playerId }, "start")}
              />
            ) : null}

            {snapshot.room.phase === "team_showing" ? (
              <CountdownTimer phaseEndsAt={snapshot.room.phase_ends_at}>
                {(secondsLeft) => (
                  <TeamBattle
                    snapshot={snapshot}
                    isHost={isHost}
                    busy={action.busy}
                    secondsLeft={secondsLeft}
                    onGenerate={() => postAction(`/api/rooms/${activeCode}/team`, { playerId }, "team")}
                    onAwardPoint={(targetPlayerId) =>
                      postAction(`/api/rooms/${activeCode}/score`, { playerId, targetPlayerId }, `score-${targetPlayerId}`)
                    }
                  />
                )}
              </CountdownTimer>
            ) : null}
          </section>

          <aside className="grid content-start gap-3 lg:gap-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-5">
              <PlayerList snapshot={snapshot} currentPlayerId={playerId} />
              <Scoreboard
                players={leaderboard}
                targetScore={
                  snapshot.room.game_mode === "five-teams" ? FIVE_TEAM_COUNT * FIVE_TEAM_ROUNDS : snapshot.room.target_score
                }
              />
              <ScoreHistory
                snapshot={snapshot}
                isHost={isHost}
                busy={action.busy}
                onUndo={(batchId) =>
                  postAction(`/api/rooms/${activeCode}/score`, { playerId, batchId }, `undo-${batchId}`, "DELETE")
                }
              />
            </div>
          </aside>
        </div>
      </div>
    </RoomShell>
  );
}
