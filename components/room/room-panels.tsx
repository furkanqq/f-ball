"use client";

import { FormEvent, useRef, useState } from "react";
import Image from "next/image";
import {
  Check,
  CircleDot,
  Crown,
  History,
  Loader2,
  Play,
  RefreshCw,
  ShieldCheck,
  Timer,
  Trophy,
  Undo2,
  Users,
  X,
} from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import {
  DEFAULT_FIVE_TEAM_SECONDS,
  FIVE_TEAM_COUNT,
  FIVE_TEAM_ROUNDS,
  MAX_FIVE_TEAM_SECONDS,
  MIN_FIVE_TEAM_SECONDS,
  TARGET_SCORES,
  TEAM_LOGOS,
} from "@/lib/constants";
import { decodeTeamSet, getAnswerVoteTotals, groupAnswersByPlayer } from "@/lib/game-utils";
import { useTranslation } from "@/lib/language-store";
import type { GameMode, RoomSnapshot, ScoreEvent, ScoreEventReason, VoteValue } from "@/lib/types";

export function RoomShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-[#07120d] text-white">
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_80%_10%,rgba(34,197,94,0.2),transparent_30%),linear-gradient(135deg,#07120d,#111812_55%,#17231b)]" />
      <div className="fixed inset-0 -z-10 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:42px_42px] opacity-60" />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </main>
  );
}

export function Lobby({
  snapshot,
  isHost,
  busy,
  onSettings,
  onStart,
}: {
  snapshot: RoomSnapshot;
  isHost: boolean;
  busy: string;
  onSettings: (gameMode: GameMode, targetScore: number, fiveTeamSeconds?: number) => void;
  onStart: () => void;
}) {
  const t = useTranslation();
  const fiveTeamSeconds = snapshot.room.five_team_seconds ?? DEFAULT_FIVE_TEAM_SECONDS;
  const durationInputRef = useRef<HTMLInputElement>(null);

  function saveFiveTeamSeconds(value?: string) {
    const rawValue = value ?? durationInputRef.current?.value ?? String(fiveTeamSeconds);
    const seconds = Math.max(
      MIN_FIVE_TEAM_SECONDS,
      Math.min(MAX_FIVE_TEAM_SECONDS, Math.trunc(Number(rawValue) || DEFAULT_FIVE_TEAM_SECONDS)),
    );

    if (durationInputRef.current) {
      durationInputRef.current.value = String(seconds);
    }

    onSettings("five-teams", snapshot.room.target_score, seconds);
  }

  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-300">{t.room.lobby}</p>
          <h2 className="mt-2 text-3xl font-black">{t.room.waitingKickoff}</h2>
          <p className="mt-2 text-zinc-300">{t.room.shareCode}</p>
        </div>
        <Users className="shrink-0 text-emerald-300" size={32} />
      </div>

      <div className="mt-6 grid gap-5">
        <ControlGroup title={t.room.gameMode}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ModeButton
              active={snapshot.room.game_mode === "initials"}
              disabled={!isHost}
              title={t.room.footballerInitials}
              detail={t.room.footballerInitialsDetail}
              onClick={() => onSettings("initials", snapshot.room.target_score)}
            />
            <ModeButton
              active={snapshot.room.game_mode === "team-battle"}
              disabled={!isHost}
              title={t.room.teamBattle}
              detail={t.room.teamBattleDetail}
              onClick={() => onSettings("team-battle", snapshot.room.target_score)}
            />
            <ModeButton
              active={snapshot.room.game_mode === "imposter"}
              disabled={!isHost}
              title={t.room.imposter}
              detail={t.room.imposterDetail}
              onClick={() => onSettings("imposter", snapshot.room.target_score)}
            />
            <ModeButton
              active={snapshot.room.game_mode === "five-teams"}
              disabled={!isHost}
              title={t.room.fiveTeams}
              detail={t.room.fiveTeamsDetail}
              onClick={() => onSettings("five-teams", snapshot.room.target_score, fiveTeamSeconds)}
            />
          </div>
        </ControlGroup>

        {snapshot.room.game_mode === "five-teams" ? (
          <ControlGroup title={t.room.fiveTeamsSeconds}>
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <div className="flex flex-wrap gap-2">
                {[5, 10, 15, 20, 30].map((seconds) => (
                  <button
                    key={seconds}
                    disabled={!isHost}
                    onClick={() => saveFiveTeamSeconds(String(seconds))}
                    className={`h-11 min-w-16 rounded-md border px-4 font-black transition ${
                      fiveTeamSeconds === seconds
                        ? "border-emerald-300 bg-emerald-300 text-emerald-950"
                        : "border-white/10 bg-white/[0.05] text-white hover:bg-white/[0.1]"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {seconds}s
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  key={fiveTeamSeconds}
                  ref={durationInputRef}
                  defaultValue={fiveTeamSeconds}
                  disabled={!isHost}
                  inputMode="numeric"
                  maxLength={2}
                  onChange={(event) => {
                    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 2);
                  }}
                  onBlur={() => saveFiveTeamSeconds()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      saveFiveTeamSeconds();
                    }
                  }}
                  className="h-11 w-24 rounded-md border border-white/10 bg-black/30 px-3 text-center font-mono text-lg font-black text-white outline-none transition focus:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label={t.room.fiveTeamsSeconds}
                />
                <button
                  onClick={() => saveFiveTeamSeconds()}
                  disabled={!isHost}
                  className="h-11 rounded-md border border-emerald-300/30 bg-emerald-300/10 px-4 font-bold text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t.common.save}
                </button>
              </div>
            </div>
          </ControlGroup>
        ) : null}

        {snapshot.room.game_mode !== "imposter" && snapshot.room.game_mode !== "five-teams" ? (
          <ControlGroup title={t.room.targetScore}>
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
        ) : null}

        {isHost ? (
          <button
            onClick={onStart}
            disabled={snapshot.players.length < (snapshot.room.game_mode === "imposter" ? 3 : 2) || Boolean(busy)}
            className="flex h-14 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 text-lg font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy === "start" ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
            {t.room.startGame}
          </button>
        ) : (
          <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-zinc-300">
            {t.room.waitingHostStart}
          </div>
        )}
      </div>
    </div>
  );
}

export function Countdown({ snapshot, secondsLeft }: { snapshot: RoomSnapshot; secondsLeft: number }) {
  const t = useTranslation();

  return (
    <div className="grid min-h-[520px] place-items-center rounded-lg border border-white/10 bg-black/25 p-6 text-center">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
          {t.common.round} {snapshot.room.current_round}
        </p>
        <div className="mt-6 text-[9rem] font-black leading-none text-white sm:text-[12rem]">{secondsLeft}</div>
        <p className="mt-4 text-xl font-bold text-zinc-200">
          {snapshot.room.game_mode === "initials"
            ? t.room.initialsIncoming
            : snapshot.room.game_mode === "five-teams"
              ? t.room.fiveTeamsIncoming
              : t.room.matchupIncoming}
        </p>
      </div>
    </div>
  );
}

export function InitialsPlaying({
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
  const t = useTranslation();
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
            {t.room.endRound}
          </button>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-black/25 p-5">
        <label className="text-sm font-bold text-zinc-200" htmlFor="answer">
          {t.room.footballerName}
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            id="answer"
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            maxLength={80}
            className="h-[52px] min-h-[52px] rounded-md border border-white/10 bg-black/30 px-4 text-lg text-white outline-none transition focus:border-emerald-300"
            placeholder={t.room.footballerName}
          />
          <button
            disabled={!currentPlayerId || !answerText.trim() || busy === "answer"}
            className="h-[52px] rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "answer" ? t.room.submitting : t.room.submit}
          </button>
        </div>
      </form>

      <div className="rounded-lg border border-white/10 bg-black/25 p-5">
        <h3 className="font-black">{t.room.yourAnswers}</h3>
        <div className="mt-3 grid gap-2">
          {myAnswers.length ? (
            myAnswers.map((answer) => (
              <div key={answer.id} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-100">
                <span>{answer.text}</span>
                <button
                  onClick={() => onDeleteAnswer(answer.id)}
                  disabled={busy === `delete-${answer.id}`}
                  className="ml-3 shrink-0 text-zinc-500 transition hover:text-red-400 disabled:opacity-50"
                  title={t.room.deleteAnswer}
                >
                  <X size={16} />
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-400">{t.room.noAnswers}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function FiveTeamsPlaying({
  snapshot,
  currentPlayerId,
  secondsLeft,
  busy,
  onSubmitAnswer,
  onDeleteAnswer,
}: {
  snapshot: RoomSnapshot;
  currentPlayerId: string | null;
  secondsLeft: number;
  busy: string;
  onSubmitAnswer: (text: string, onSuccess: () => void) => void;
  onDeleteAnswer: (answerId: string) => void;
}) {
  const t = useTranslation();
  const [answerText, setAnswerText] = useState("");
  const teams = decodeTeamSet(snapshot.room.team_a);
  const myAnswer = snapshot.answers.find((answer) => answer.player_id === currentPlayerId) ?? null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmitAnswer(answerText, () => setAnswerText(""));
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-200">
              {t.common.round} {snapshot.room.current_round}/{FIVE_TEAM_ROUNDS}
            </p>
            <h2 className="mt-2 text-3xl font-black">{t.room.fiveTeams}</h2>
          </div>
          <div className="inline-flex h-11 items-center gap-2 self-start rounded-md border border-emerald-300/30 bg-black/20 px-4 font-mono text-xl font-black text-emerald-100 sm:self-auto">
            <Timer size={18} />
            {secondsLeft}s
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {teams.map((team) => (
            <TeamName key={team} name={team} />
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border border-white/10 bg-black/25 p-5">
        <label className="text-sm font-bold text-zinc-200" htmlFor="five-team-answer">
          {t.room.playerName}
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            id="five-team-answer"
            value={answerText}
            onChange={(event) => setAnswerText(event.target.value)}
            maxLength={80}
            className="h-[52px] min-h-[52px] rounded-md border border-white/10 bg-black/30 px-4 text-lg text-white outline-none transition focus:border-emerald-300"
            placeholder={myAnswer?.text ?? t.room.playerName}
          />
          <button
            disabled={!currentPlayerId || !answerText.trim() || busy === "answer"}
            className="h-[52px] rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "answer" ? t.room.saving : myAnswer ? t.room.update : t.room.submit}
          </button>
        </div>
        {myAnswer ? (
          <div className="mt-3 flex items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-zinc-100">
            <span>{myAnswer.text}</span>
            <button
              type="button"
              onClick={() => onDeleteAnswer(myAnswer.id)}
              disabled={busy === `delete-${myAnswer.id}`}
              className="ml-3 shrink-0 text-zinc-500 transition hover:text-red-400 disabled:opacity-50"
              title={t.room.deleteAnswer}
            >
              <X size={16} />
            </button>
          </div>
        ) : null}
      </form>
    </div>
  );
}

export function FiveTeamsReveal({
  snapshot,
  isHost,
  busy,
  onScoreRound,
}: {
  snapshot: RoomSnapshot;
  isHost: boolean;
  busy: string;
  onScoreRound: (scores: { playerId: string; points: number }[]) => void;
}) {
  const t = useTranslation();
  const teams = decodeTeamSet(snapshot.room.team_a);
  const [scoreInputs, setScoreInputs] = useState<Record<string, number>>(() =>
    Object.fromEntries(snapshot.players.map((player) => [player.id, 0])),
  );

  function setPlayerScore(playerId: string, value: string) {
    const points = Math.max(0, Math.min(FIVE_TEAM_COUNT, Number(value) || 0));
    setScoreInputs((current) => ({ ...current, [playerId]: points }));
  }

  function saveScores() {
    onScoreRound(snapshot.players.map((player) => ({ playerId: player.id, points: scoreInputs[player.id] ?? 0 })));
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-white/10 bg-black/25 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
              {t.common.round} {snapshot.room.current_round}/{FIVE_TEAM_ROUNDS}
            </p>
            <h2 className="mt-2 text-3xl font-black">{t.room.answers}</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {teams.map((team) => (
              <TeamPill key={team} name={team} />
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {snapshot.players.map((player) => {
          const answer = snapshot.answers.find((item) => item.player_id === player.id);

          return (
            <div key={player.id} className="rounded-lg border border-white/10 bg-black/25 p-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-zinc-400">{player.nickname}</p>
                  <p className="mt-1 truncate text-2xl font-black text-white">{answer?.text ?? t.room.noAnswer}</p>
                </div>
                {isHost ? (
                  <label className="flex items-center gap-2">
                    <span className="text-sm font-bold text-zinc-300">{t.common.point}</span>
                    <input
                      type="number"
                      min={0}
                      max={FIVE_TEAM_COUNT}
                      value={scoreInputs[player.id] ?? 0}
                      onChange={(event) => setPlayerScore(player.id, event.target.value)}
                      className="h-11 w-20 rounded-md border border-white/10 bg-black/30 px-3 text-center font-mono text-lg font-black text-white outline-none transition [appearance:textfield] focus:border-emerald-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </label>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {isHost ? (
        <button
          onClick={saveScores}
          disabled={Boolean(busy)}
          className="flex h-[52px] items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "score-round" ? <Loader2 className="animate-spin" size={18} /> : <Trophy size={18} />}
          {snapshot.room.current_round >= FIVE_TEAM_ROUNDS ? t.room.saveScoresAndFinish : t.room.saveScores}
        </button>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm text-zinc-400">
          {t.room.hostScoring}
        </div>
      )}
    </div>
  );
}

export function Reveal({
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
  const t = useTranslation();
  const grouped = groupAnswersByPlayer(snapshot.players, snapshot.answers);

  return (
    <div className="grid gap-5">
      <div className="rounded-lg border border-white/10 bg-black/25 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">{t.room.reveal}</p>
            <h2 className="mt-2 text-3xl font-black">{t.room.voteAnswers}</h2>
          </div>
          {isHost ? (
            <button
              onClick={onFinalize}
              disabled={Boolean(busy)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "finalize" ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
              {t.room.finalizeRound}
            </button>
          ) : null}
        </div>
      </div>

      {grouped.map(({ player, answers }) => (
        <div key={player.id} className="rounded-lg border border-white/10 bg-black/25 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black">{player.nickname}</h3>
            {player.id === currentPlayerId ? <span className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-400">{t.common.you}</span> : null}
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
              <p className="text-sm text-zinc-400">{t.room.noAnswersSubmitted}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function LeaderboardPanel({
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
  const t = useTranslation();
  const winner = snapshot.players.find((player) => player.id === snapshot.room.winner_player_id);
  const players = [...snapshot.players].sort((a, b) => b.score - a.score || a.joined_at.localeCompare(b.joined_at));
  const isFinished = snapshot.room.phase === "finished";
  const title = winner ? winner.nickname : isFinished ? t.common.draw : `${t.common.round} ${snapshot.room.current_round} ${t.room.complete}`;

  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-5">
      <div className="text-center">
        <Trophy className="mx-auto text-emerald-300" size={42} />
        <p className="mt-4 text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
          {winner ? t.common.winner : isFinished ? t.common.final : t.common.leaderboard}
        </p>
        <h2 className="mt-2 text-4xl font-black">{title}</h2>
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

      {isHost && !isFinished ? (
        <button
          onClick={onNextRound}
          disabled={Boolean(busy)}
          className="mt-6 flex h-[52px] w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy === "start" ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
          {t.room.nextRound}
        </button>
      ) : null}
    </div>
  );
}

export function TeamBattle({
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
  const t = useTranslation();
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
          {secondsLeft > 0 ? `${secondsLeft}s` : t.common.time}
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <TeamName name={snapshot.room.team_a ?? t.room.teamA} />
          <div className="text-3xl font-black text-emerald-300">VS</div>
          <TeamName name={snapshot.room.team_b ?? t.room.teamB} />
        </div>

        {isHost ? (
          <div className="mt-8 grid gap-4">
            <div>
              <p className="mb-3 text-sm font-bold uppercase tracking-[0.16em] text-zinc-400">{t.room.awardPoint}</p>
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
                <p className="mt-2 text-sm text-zinc-400">{t.room.pointAwarded}</p>
              ) : null}
            </div>
            <button
              onClick={onGenerate}
              disabled={Boolean(busy)}
              className="mx-auto inline-flex h-[52px] items-center justify-center gap-2 rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy === "team" ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              {t.room.generateMatchup}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PlayerList({ snapshot, currentPlayerId }: { snapshot: RoomSnapshot; currentPlayerId: string | null }) {
  const t = useTranslation();

  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between sm:mb-4">
        <h2 className="text-sm font-black sm:text-base">{t.common.players}</h2>
        <span className="text-xs font-bold text-emerald-300 sm:text-sm">{snapshot.players.length}/8</span>
      </div>
      <div className="grid gap-1.5 sm:gap-2">
        {snapshot.players.map((player) => (
          <div key={player.id} className="flex items-center justify-between rounded-md bg-white/[0.04] px-2.5 py-2 sm:px-3 sm:py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-white">{player.nickname}</div>
            </div>
            {player.id === currentPlayerId ? (
              <span className="ml-1.5 shrink-0 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs">{t.common.you}</span>
            ) : null}
            {player.is_host ? (
              <span className="ml-1.5 inline-flex shrink-0 items-center gap-0.5 rounded-full bg-emerald-300/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200 sm:gap-1 sm:px-2 sm:py-1 sm:text-xs">
                <Crown size={10} />
                <span className="hidden sm:inline">{t.common.host}</span>
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Scoreboard({ players, targetScore }: { players: RoomSnapshot["players"]; targetScore: number }) {
  const t = useTranslation();

  return (
    <div className="rounded-lg border border-white/10 bg-black/25 p-3 sm:p-5">
      <div className="mb-2 flex items-center justify-between sm:mb-4">
        <h2 className="text-sm font-black sm:text-base">{t.common.scores}</h2>
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

export function ScoreHistory({
  snapshot,
  isHost,
  busy,
  onUndo,
}: {
  snapshot: RoomSnapshot;
  isHost: boolean;
  busy: string;
  onUndo: (batchId: string) => void;
}) {
  const t = useTranslation();
  const playerById = new Map(snapshot.players.map((player) => [player.id, player]));
  const batches = groupScoreEvents(snapshot.scoreEvents).slice(0, 6);

  return (
    <div className="col-span-2 rounded-lg border border-white/10 bg-black/25 p-3 sm:p-5 lg:col-span-1">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 text-sm font-black sm:text-base">
          <History size={16} className="text-emerald-300" />
          {t.common.scoreHistory}
        </h2>
      </div>

      {batches.length ? (
        <div className="grid gap-2.5">
          {batches.map((batch) => {
            const isUndone = Boolean(batch.undoneAt);

            return (
              <div key={batch.batchId} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-500">
                      {t.common.round} {batch.roundNumber}
                    </div>
                    <div className="mt-1 truncate text-sm font-black text-white">{t.common.scoreReasons[batch.reason]}</div>
                  </div>
                  {isUndone ? (
                    <span className="rounded-full border border-zinc-500/30 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                      {t.common.undone}
                    </span>
                  ) : isHost ? (
                    <button
                      onClick={() => onUndo(batch.batchId)}
                      disabled={Boolean(busy)}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.05] px-2 text-xs font-bold text-zinc-100 transition hover:border-emerald-300/40 hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {busy === `undo-${batch.batchId}` ? <Loader2 className="animate-spin" size={13} /> : <Undo2 size={13} />}
                      {t.common.undoScore}
                    </button>
                  ) : null}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {batch.events.map((event) => {
                    const player = playerById.get(event.player_id);
                    const delta = event.delta > 0 ? `+${event.delta}` : String(event.delta);

                    return (
                      <span
                        key={event.id}
                        className={`rounded border px-2 py-1 text-xs font-bold ${
                          event.delta >= 0
                            ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                            : "border-red-300/20 bg-red-300/10 text-red-200"
                        }`}
                      >
                        {player?.nickname ?? "?"} {delta}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">{t.common.noScoreHistory}</p>
      )}
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
  const t = useTranslation();
  const Icon = icon === "accept" ? Check : X;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={icon === "accept" ? t.room.acceptAnswer : t.room.rejectAnswer}
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

export function ImposterPhase({
  snapshot,
  currentPlayerId,
  isHost,
  busy,
  onNewRound,
}: {
  snapshot: RoomSnapshot;
  currentPlayerId: string | null;
  isHost: boolean;
  busy: string;
  onNewRound: () => void;
}) {
  const t = useTranslation();
  const [revealed, setRevealed] = useState(false);
  const isImposter = currentPlayerId !== null && currentPlayerId === snapshot.room.imposter_player_id;
  const imposterPlayer = snapshot.players.find((p) => p.id === snapshot.room.imposter_player_id);

  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-white/10 bg-black/25 p-6 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-300">
          {t.common.round} {snapshot.room.current_round} · {t.room.imposter}
        </p>

        {isImposter ? (
          <div className="mt-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300">
              {t.room.imposterBadge}
            </div>
            <p className="mt-5 text-sm text-zinc-400">{t.room.yourClue}</p>
            <div className="mt-3 font-mono text-6xl font-black tracking-wide text-white sm:text-7xl">
              {snapshot.room.imposter_clue}
            </div>
            <p className="mt-5 text-sm text-zinc-400">{t.room.hideAndGuess}</p>
          </div>
        ) : (
          <div className="mt-6">
            <p className="text-sm text-zinc-400">{t.room.footballer}</p>
            <div className="mt-3 text-5xl font-black leading-tight text-white sm:text-6xl">
              {snapshot.room.imposter_player_name}
            </div>
            <p className="mt-5 text-sm text-zinc-400">{t.room.findImposter}</p>
          </div>
        )}
      </div>

      {isHost ? (
        <div className="grid gap-3 rounded-lg border border-white/10 bg-black/25 p-4">
          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-4 font-bold text-white transition hover:bg-white/[0.1]"
            >
              <Users size={18} />
              {t.room.showImposter}
            </button>
          ) : (
            <div className="rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-center">
              <p className="text-xs text-zinc-400">{t.room.imposter}</p>
              <p className="mt-1 text-xl font-black text-red-300">{imposterPlayer?.nickname ?? "?"}</p>
            </div>
          )}
          <button
            onClick={() => { setRevealed(false); onNewRound(); }}
            disabled={Boolean(busy)}
            className="flex h-12 items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 font-black text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy === "start" ? <Loader2 className="animate-spin" size={18} /> : <Play size={18} />}
            {t.room.newRound}
          </button>
        </div>
      ) : (
        <div className="rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-center text-sm text-zinc-400">
          {t.room.discussImposter}
        </div>
      )}
    </div>
  );
}

function TeamPill({ name }: { name: string }) {
  const logo = TEAM_LOGOS[name];

  return (
    <div className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.05] px-3">
      {logo ? <Image src={logo} alt="" width={24} height={24} className="h-6 w-6 object-contain" /> : null}
      <span className="text-xs font-bold text-zinc-100 sm:text-sm">{name}</span>
    </div>
  );
}

function TeamName({ name }: { name: string }) {
  const logo = TEAM_LOGOS[name];

  return (
    <div className="grid min-h-36 place-items-center rounded-lg border border-white/10 bg-white/[0.05] px-5 py-6">
      {logo ? (
        <div className="flex flex-col items-center gap-3">
          <Image src={logo} alt={name} width={96} height={96} className="h-20 w-20 object-contain drop-shadow-lg sm:h-24 sm:w-24" />
          <span className="text-sm font-bold text-white">{name}</span>
        </div>
      ) : (
        <div className="text-3xl font-black leading-tight text-white sm:text-4xl">{name}</div>
      )}
    </div>
  );
}

type ScoreEventBatch = {
  batchId: string;
  roundNumber: number;
  reason: ScoreEventReason;
  createdAt: string;
  undoneAt: string | null;
  events: ScoreEvent[];
};

function groupScoreEvents(events: ScoreEvent[]) {
  const batches = new Map<string, ScoreEventBatch>();

  for (const event of events) {
    const batch = batches.get(event.batch_id);

    if (batch) {
      batch.events.push(event);
      batch.undoneAt = batch.undoneAt || event.undone_at;
      continue;
    }

    batches.set(event.batch_id, {
      batchId: event.batch_id,
      roundNumber: event.round_number,
      reason: event.reason,
      createdAt: event.created_at,
      undoneAt: event.undone_at,
      events: [event],
    });
  }

  return [...batches.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function PhaseBadge({ phase }: { phase: RoomSnapshot["room"]["phase"] }) {
  const t = useTranslation();

  return (
    <span className="inline-flex h-10 items-center gap-1.5 rounded-md border border-emerald-300/20 bg-emerald-300/10 px-2.5 text-xs font-bold capitalize text-emerald-100 sm:h-11 sm:gap-2 sm:px-4 sm:text-sm">
      <CircleDot size={13} />
      {t.phase[phase]}
    </span>
  );
}
