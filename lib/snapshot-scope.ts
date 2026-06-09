import type { GameMode, RoomPhase } from "@/lib/types";

export function shouldIncludeClientAnswers(phase: RoomPhase, gameMode: GameMode) {
  return (
    (phase === "playing" && (gameMode === "initials" || gameMode === "five-teams")) ||
    (phase === "reveal" && (gameMode === "initials" || gameMode === "five-teams"))
  );
}

export function shouldIncludeClientVotes(phase: RoomPhase, gameMode: GameMode) {
  return phase === "reveal" && gameMode === "initials";
}

export function shouldLimitClientAnswersToPlayer(phase: RoomPhase) {
  return phase === "playing";
}
