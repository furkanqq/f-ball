"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  CircleDot,
  Copy,
  Crown,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Timer,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { TARGET_SCORES } from "@/lib/constants";
import { getAnswerVoteTotals, groupAnswersByPlayer } from "@/lib/game-utils";
import { useSessionStore } from "@/lib/session-store";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { ApiError, GameMode, RoomSnapshot, VoteValue } from "@/lib/types";

type RoomClientProps = {
  code: string;
};

type ActionState = {
  busy: string;
  error: string;
};

export function RoomClient({ code }: RoomClientProps) {
  const { playerId, roomCode } = useSessionStore();
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [action, setAction] = useState<ActionState>({ busy: "", error: "" });
  const advancedPhaseRef = useRef("");

  const loadSnapshot = useCallback(async () => {
    const response = await fetch(`/api/rooms/${code}/snapshot`, { cache: "no-store" });
    const data = (await response.json()) as RoomSnapshot | ApiError;

    if ("error" in data) {
      setAction((current) => ({ ...current, error: data.error }));
    } else {
      setSnapshot(data);
      setAction((current) => ({ ...current, error: "" }));
    }

    setLoading(false);
  }, [code]);

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

    const channel = supabase
      .channel(`room-${snapshot.room.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${snapshot.room.id}` }, () =>
        void loadSnapshot(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players", filter: `room_id=eq.${snapshot.room.id}` },
        () => void loadSnapshot(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "answers", filter: `room_id=eq.${snapshot.room.id}` },
        () => void loadSnapshot(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "votes", filter: `room_id=eq.${snapshot.room.id}` },
        () => void loadSnapshot(),
      )
      .subscribe();

    return () => {
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [loadSnapshot, snapshot?.room.id]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!snapshot?.room.phase_ends_at) {
        setSecondsLeft(0);
        return;
      }

      setSecondsLeft(Math.max(0, Math.ceil((new Date(snapshot.room.phase_ends_at).getTime() - Date.now()) / 1000)));
    }, 250);

    return () => window.clearInterval(interval);
  }, [snapshot?.room.phase_ends_at]);

  const isHost = Boolean(playerId && snapshot?.room.host_player_id === playerId);
  const currentPlayer = snapshot?.players.find((player) => player.id === playerId) ?? null;
  const activeCode = snapshot?.room.code ?? code;
  const isSessionForRoom = roomCode === activeCode && Boolean(currentPlayer);

  const leaderboard = useMemo(
    () => [...(snapshot?.players ?? [])].sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at)),
    [snapshot?.players],
  );

  const postAction = useCallback(async (path: string, body: Record<string, unknown>, busy: string, method?: string) => {
    setAction({ busy, error: "" });
    const response = await fetch(path, {
      method: method ?? (path.includes("/settings") ? "PATCH" : "POST"),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as ApiError | unknown;

    if (response.ok) {
      await loadSnapshot();
      setAction({ busy: "", error: "" });
      return true;
    }

    setAction({ busy: "", error: "error" in (data as ApiError) ? (data as ApiError).error : "Action failed." });
    return false;
  }, [loadSnapshot]);

  useEffect(() => {
    if (!snapshot || !isHost || secondsLeft > 0 || !snapshot.room.phase_ends_at) {
      return;
    }

    if (snapshot.room.phase !== "countdown" && snapshot.room.phase !== "playing") {
      return;
    }

    const phaseKey = `${snapshot.room.id}:${snapshot.room.current_round}:${snapshot.room.phase}`;

    if (advancedPhaseRef.current === phaseKey) {
      return;
    }

    advancedPhaseRef.current = phaseKey;
    void postAction(`/api/rooms/${activeCode}/advance`, { playerId }, "advance");
  }, [activeCode, isHost, playerId, postAction, secondsLeft, snapshot]);

  async function copyCode() {
    await navigator.clipboard?.writeText(activeCode);
  }

  async function submitAnswer(text: string, onSuccess: () => void) {
    if (!text.trim() || !playerId) {
      return;
    }

    const ok = await postAction(`/api/rooms/${activeCode}/answers`, { playerId, text }, "answer");

    if (ok) {
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
          Loading room...
        </div>
      </RoomShell>
    );
  }

  if (!snapshot) {
    return (
      <RoomShell>
        <div className="mx-auto max-w-md rounded-lg border border-white/10 bg-white/[0.04] p-6 text-center">
          <h1 className="text-2xl font-black">Room unavailable</h1>
          <p className="mt-2 text-zinc-300">{action.error || "This room could not be loaded."}</p>
          <Link className="mt-5 inline-flex rounded-md bg-emerald-400 px-4 py-3 font-bold text-emerald-950" href="/">
            Back home
          </Link>
        </div>
      </RoomShell>
    );
  }

  return (
    <RoomShell>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="rounded-lg border border-white/10 bg-black/25 px-3 py-3 backdrop-blur sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Link className="text-xs font-semibold text-emerald-300 sm:text-sm" href="/">
                Football Party
              </Link>
              <h1 className="text-lg font-black text-white sm:text-3xl">
                Room <span className="font-mono text-emerald-300">{activeCode}</span>
              </h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={copyCode}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.05] px-2.5 text-xs font-bold text-white transition hover:bg-white/[0.1] sm:h-11 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Copy size={14} />
                <span className="hidden sm:inline">Copy Code</span>
              </button>
              <PhaseBadge phase={snapshot.room.phase} />
            </div>
          </div>
        </header>

        {action.error ? (
          <div className="rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">{action.error}</div>
        ) : null}

        {!isSessionForRoom ? (
          <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-4 text-sm text-amber-50">
            This browser is not joined as a player in this room. Join again from the home page to participate.
          </div>
        ) : null}

        <div className="grid gap-4 lg:gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0 order-last lg:order-none">
            {snapshot.room.phase === "lobby" ? (
              <Lobby
                snapshot={snapshot}
                isHost={isHost}
                busy={action.busy}
                onSettings={(gameMode, targetScore) =>
                  postAction(
                    `/api/rooms/${activeCode}/settings`,
                    { playerId, gameMode, targetScore },
                    `settings-${gameMode}-${targetScore}`,
                  )
                }
                onStart={() => postAction(`/api/rooms/${activeCode}/start`, { playerId }, "start")}
              />
            ) : null}

            {snapshot.room.phase === "countdown" ? <Countdown snapshot={snapshot} secondsLeft={secondsLeft} /> : null}

            {snapshot.room.phase === "playing" ? (
              <InitialsPlaying
                snapshot={snapshot}
                currentPlayerId={playerId}
                secondsLeft={secondsLeft}
                isHost={isHost}
                busy={action.busy}
                onSubmitAnswer={submitAnswer}
                onDeleteAnswer={deleteAnswer}
                onEndRound={() => postAction(`/api/rooms/${activeCode}/advance`, { playerId }, "advance")}
              />
            ) : null}

            {snapshot.room.phase === "reveal" ? (
              <Reveal
                snapshot={snapshot}
                currentPlayerId={playerId}
                isHost={isHost}
                busy={action.busy}
                onVote={(answerId, vote) => postAction(`/api/rooms/${activeCode}/votes`, { playerId, answerId, vote }, answerId)}
                onFinalize={() => postAction(`/api/rooms/${activeCode}/finalize`, { playerId }, "finalize")}
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

            {snapshot.room.phase === "team_showing" ? (
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
            ) : null}
          </section>

          <aside className="grid content-start gap-3 lg:gap-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-5">
              <PlayerList snapshot={snapshot} currentPlayerId={playerId} />
              <Scoreboard players={leaderboard} targetScore={snapshot.room.target_score} />
            </div>
          </aside>
        </div>
      </div>
    </RoomShell>
  );
}

function RoomShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#07120d] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_80%_10%,rgba(34,197,94,0.2),transparent_30%),linear-gradient(135deg,#07120d,#111812_55%,#17231b)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:42px_42px] opacity-60" />
      {children}
    </main>
  );
}

function Lobby({
  snapshot,
  isHost,
  busy,
  onSettings,
  onStart,
}: {
  snapshot: RoomSnapshot;
  isHost: boolean;
  busy: string;
  onSettings: (gameMode: GameMode, targetScore: number) => void;
  onStart: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-300">Lobby</p>
          <h2 className="mt-2 text-3xl font-black">Waiting for kickoff</h2>
          <p className="mt-2 text-zinc-300">Share the room code. The host can start once at least two players have joined.</p>
        </div>
        <Users className="shrink-0 text-emerald-300" size={32} />
      </div>

      <div className="mt-6 grid gap-5">
        <ControlGroup title="Game Mode">
          <div className="grid gap-3 sm:grid-cols-2">
            <ModeButton
              active={snapshot.room.game_mode === "initials"}
              disabled={!isHost}
              title="Footballer Initials"
              detail="Write player names for random initials."
              onClick={() => onSettings("initials", snapshot.room.target_score)}
            />
            <ModeButton
              active={snapshot.room.game_mode === "team-battle"}
              disabled={!isHost}
              title="Random Team Battle"
              detail="Generate matchups for verbal debates."
              onClick={() => onSettings("team-battle", snapshot.room.target_score)}
            />
          </div>
        </ControlGroup>

        <ControlGroup title="Target Score">
          <div className="flex flex-wrap gap-2">
            {TARGET_SCORES.map((score) => (
              <button
                key={score}
                disabled={!isHost}
                onClick={() => onSettings(snapshot.room.game_mode, score)}
                className={`h-11 min-w-16 rounded-md border px-4 font-black transition ${
                  snapshot.room.target_score === score
                    ? "border-emerald-300 bg-emerald-300 text-emerald-950"
                    : "border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.1]"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {score}
              </button>
            ))}
          </div>
        </ControlGroup>

        {isHost ? (
          <button
            onClick={onStart}
            disabled={snapshot.players.length < 2 || Boolean(busy)}
            className="flex h-14 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 text-lg font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "start" ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
            Start Game
          </button>
        ) : (
          <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
            Waiting for the host to start the game.
          </div>
        )}
      </div>
    </div>
  );
}

function Countdown({ snapshot, secondsLeft }: { snapshot: RoomSnapshot; secondsLeft: number }) {
  return (
    <div className="grid min-h-[520px] place-items-center rounded-lg border border-white/10 bg-black/25 p-6 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">Round {snapshot.room.current_round}</p>
        <div className="mt-6 text-[9rem] font-black leading-none text-white sm:text-[12rem]">{secondsLeft}</div>
        <p className="mt-4 text-xl font-bold text-zinc-200">
          {snapshot.room.game_mode === "initials" ? "Initials incoming" : "Matchup incoming"}
        </p>
      </div>
    </div>
  );
}

function InitialsPlaying({
  snapshot,
  currentPlayerId,
  secondsLeft,
  isHost,
  busy,
  onSubmitAnswer,
  onDeleteAnswer,
  onEndRound,
}: {
  snapshot: RoomSnapshot;
  currentPlayerId: string | null;
  secondsLeft: number;
  isHost: boolean;
  busy: string;
  onSubmitAnswer: (text: string, onSuccess: () => void) => void;
  onDeleteAnswer: (answerId: string) => void;
  onEndRound: () => void;
}) {
  const [answerText, setAnswerText] = useState("");
  const myAnswers = snapshot.answers.filter((answer) => answer.player_id === currentPlayerId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmitAnswer(answerText, () => setAnswerText(""));
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-6 text-center">
        <div className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.18em] text-emerald-200">
          <Timer size={16} />
          {secondsLeft}s
        </div>
        <div className="mt-4 font-mono text-7xl font-black tracking-[0.18em] text-white sm:text-8xl">{snapshot.room.initials}</div>
        {isHost ? (
          <button
            onClick={onEndRound}
            disabled={Boolean(busy)}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-md border border-emerald-300/30 bg-black/20 px-4 text-sm font-bold text-emerald-200 transition hover:bg-black/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Timer size={14} />
            End Round
          </button>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-black/25 p-5">
        <label className="text-sm font-bold text-zinc-200" htmlFor="answer">
          Footballer name
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            id="answer"
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            maxLength={80}
            className="h-[52px] min-h-[52px] rounded-md border border-white/10 bg-black/30 px-4 text-lg text-white outline-none transition focus:border-emerald-300"
            placeholder="Footballer name"
          />
          <button
            disabled={!currentPlayerId || !answerText.trim() || busy === "answer"}
            className="h-[52px] rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "answer" ? "Submitting..." : "Submit"}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-white/10 bg-black/25 p-5">
        <h3 className="font-black">Your answers</h3>
        <div className="mt-3 grid gap-2">
          {myAnswers.length ? (
            myAnswers.map((answer) => (
              <div key={answer.id} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-100">
                <span>{answer.text}</span>
                <button
                  onClick={() => onDeleteAnswer(answer.id)}
                  disabled={busy === `delete-${answer.id}`}
                  className="ml-3 shrink-0 text-zinc-500 transition hover:text-red-400 disabled:opacity-50"
                  title="Delete answer"
                >
                  <X size={16} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-400">No answers yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Reveal({
  snapshot,
  currentPlayerId,
  isHost,
  busy,
  onVote,
  onFinalize,
}: {
  snapshot: RoomSnapshot;
  currentPlayerId: string | null;
  isHost: boolean;
  busy: string;
  onVote: (answerId: string, vote: VoteValue) => void;
  onFinalize: () => void;
}) {
  const grouped = groupAnswersByPlayer(snapshot.players, snapshot.answers);

  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-white/10 bg-black/25 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">Reveal</p>
            <h2 className="mt-2 text-3xl font-black">Vote on answers</h2>
          </div>
          {isHost ? (
            <button
              onClick={onFinalize}
              disabled={Boolean(busy)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "finalize" ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              Finalize Round
            </button>
          ) : null}
        </div>
      </div>

      {grouped.map(({ player, answers }) => (
        <div key={player.id} className="rounded-lg border border-white/10 bg-black/25 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">{player.nickname}</h3>
            {player.id === currentPlayerId ? <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">You</span> : null}
          </div>

          <div className="mt-4 grid gap-3">
            {answers.length ? (
              answers.map((answer) => {
                const totals = getAnswerVoteTotals(answer.id, snapshot.votes);
                const myVote = snapshot.votes.find((vote) => vote.answer_id === answer.id && vote.voter_player_id === currentPlayerId);
                const ownAnswer = answer.player_id === currentPlayerId;

                return (
                  <div key={answer.id} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 text-lg font-bold text-white">{answer.text}</div>
                      <div className="flex shrink-0 items-center gap-2">
                        <VoteButton
                          active={myVote?.vote === "accept"}
                          disabled={ownAnswer || !currentPlayerId}
                          icon="accept"
                          label={String(totals.accept)}
                          onClick={() => onVote(answer.id, "accept")}
                        />
                        <VoteButton
                          active={myVote?.vote === "reject"}
                          disabled={ownAnswer || !currentPlayerId}
                          icon="reject"
                          label={String(totals.reject)}
                          onClick={() => onVote(answer.id, "reject")}
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-sm text-zinc-400">No answers submitted.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function LeaderboardPanel({
  snapshot,
  isHost,
  busy,
  onNextRound,
}: {
  snapshot: RoomSnapshot;
  isHost: boolean;
  busy: string;
  onNextRound: () => void;
}) {
  const winner = snapshot.players.find((player) => player.id === snapshot.room.winner_player_id);
  const players = [...snapshot.players].sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));

  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-5">
      <div className="text-center">
        <Trophy className="mx-auto text-emerald-300" size={42} />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
          {winner ? "Winner" : "Leaderboard"}
        </p>
        <h2 className="mt-2 text-4xl font-black">{winner ? winner.nickname : `Round ${snapshot.room.current_round} complete`}</h2>
      </div>

      <div className="mt-6 grid gap-3">
        {players.map((player, index) => (
          <div key={player.id} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-300/15 font-black text-emerald-200">{index + 1}</div>
              <span className="font-bold">{player.nickname}</span>
            </div>
            <span className="font-mono text-xl font-black text-emerald-300">{player.score}</span>
          </div>
        ))}
      </div>

      {isHost && !winner ? (
        <button
          onClick={onNextRound}
          disabled={Boolean(busy)}
          className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "start" ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
          Next Round
        </button>
      ) : null}
    </div>
  );
}

function TeamBattle({
  snapshot,
  isHost,
  busy,
  secondsLeft,
  onGenerate,
  onAwardPoint,
}: {
  snapshot: RoomSnapshot;
  isHost: boolean;
  busy: string;
  secondsLeft: number;
  onGenerate: () => void;
  onAwardPoint: (targetPlayerId: string) => void;
}) {
  const [scoredMatchup, setScoredMatchup] = useState<string | null>(null);
  const matchupKey = `${snapshot.room.team_a}|${snapshot.room.team_b}`;
  const alreadyScored = scoredMatchup === matchupKey;

  function handleAwardPoint(targetPlayerId: string) {
    setScoredMatchup(matchupKey);
    onAwardPoint(targetPlayerId);
  }

  return (
    <div className="grid min-h-[520px] place-items-center rounded-lg border border-white/10 bg-black/25 p-5 text-center">
      <div className="w-full max-w-3xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-100">
          <Timer size={16} />
          {secondsLeft > 0 ? `${secondsLeft}s` : "Time"}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamName name={snapshot.room.team_a ?? "Team A"} />
          <div className="text-3xl font-black text-emerald-300">VS</div>
          <TeamName name={snapshot.room.team_b ?? "Team B"} />
        </div>

        {isHost ? (
          <div className="mt-8 grid gap-4">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-zinc-400">Award Point</p>
              <div className="flex flex-wrap justify-center gap-2">
                {snapshot.players.map((player) => (
                  <button
                    key={player.id}
                    onClick={() => handleAwardPoint(player.id)}
                    disabled={Boolean(busy) || alreadyScored}
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-4 font-bold text-white transition hover:border-emerald-300/50 hover:bg-emerald-300/10 hover:text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy === `score-${player.id}` ? <Loader2 className="animate-spin" size={14} /> : <Trophy size={14} />}
                    {player.nickname}
                  </button>
                ))}
              </div>
              {alreadyScored ? (
                <p className="mt-2 text-sm text-zinc-400">Point awarded. Generate a new matchup to continue.</p>
              ) : null}
            </div>
            <button
              onClick={onGenerate}
              disabled={Boolean(busy)}
              className="mx-auto inline-flex h-[52px] items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "team" ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              Generate New Matchup
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PlayerList({ snapshot, currentPlayerId }: { snapshot: RoomSnapshot; currentPlayerId: string | null }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between sm:mb-4">
        <h2 className="text-sm font-black sm:text-base">Players</h2>
        <span className="text-xs font-bold text-emerald-300 sm:text-sm">{snapshot.players.length}/8</span>
      </div>
      <div className="grid gap-1.5 sm:gap-2">
        {snapshot.players.map((player) => (
          <div key={player.id} className="flex items-center justify-between rounded-md bg-white/[0.04] px-2.5 py-2 sm:px-3 sm:py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{player.nickname}</div>
            </div>
            {player.is_host ? (
              <span className="ml-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200 sm:gap-1 sm:px-2 sm:py-1 sm:text-xs">
                <Crown size={10} />
                <span className="hidden sm:inline">Host</span>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Scoreboard({ players, targetScore }: { players: RoomSnapshot["players"]; targetScore: number }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between sm:mb-4">
        <h2 className="text-sm font-black sm:text-base">Scores</h2>
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400 sm:text-xs">/{targetScore}</span>
      </div>
      <div className="grid gap-2 sm:gap-3">
        {players.map((player) => (
          <div key={player.id}>
            <div className="mb-1 flex items-center justify-between text-xs sm:text-sm">
              <span className="min-w-0 truncate font-semibold text-zinc-200">{player.nickname}</span>
              <span className="ml-2 shrink-0 font-mono font-black text-emerald-300">{player.score}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10 sm:h-2">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${Math.max(0, Math.min(100, (player.score / targetScore) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ControlGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-zinc-400">{title}</h3>
      {children}
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border p-4 text-left transition ${
        active ? "border-emerald-300 bg-emerald-300/15" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      <div className="flex items-center gap-2 font-black text-white">
        <CircleDot size={16} className={active ? "text-emerald-300" : "text-zinc-500"} />
        {title}
      </div>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{detail}</p>
    </button>
  );
}

function VoteButton({
  active,
  disabled,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  icon: "accept" | "reject";
  label: string;
  onClick: () => void;
}) {
  const Icon = icon === "accept" ? Check : X;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={icon === "accept" ? "Accept answer" : "Reject answer"}
      className={`inline-flex h-11 min-w-[3.5rem] items-center justify-center gap-1.5 rounded-md border px-3 font-black transition ${
        active
          ? icon === "accept"
            ? "border-emerald-300 bg-emerald-300 text-emerald-950"
            : "border-red-300 bg-red-300 text-red-950"
          : "border-white/10 bg-white/[0.04] text-zinc-200 hover:bg-white/[0.08]"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <Icon size={17} />
      {label}
    </button>
  );
}

function TeamName({ name }: { name: string }) {
  return (
    <div className="grid min-h-36 place-items-center rounded-lg border border-white/10 bg-white/[0.05] px-5 py-8">
      <div className="text-3xl font-black leading-tight text-white sm:text-4xl">{name}</div>
    </div>
  );
}

function PhaseBadge({ phase }: { phase: RoomSnapshot["room"]["phase"] }) {
  return (
    <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 text-xs font-bold capitalize text-emerald-100 sm:h-11 sm:gap-2 sm:px-4 sm:text-sm">
      <CircleDot size={13} />
      {phase.replace("_", " ")}
    </span>
  );
}
