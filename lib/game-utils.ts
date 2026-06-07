import { INITIAL_SEEDS, TEAM_DATABASE } from "@/lib/constants";
import type { Answer, Player, Vote } from "@/lib/types";

export function createRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

export function normalizeRoomCode(code: string) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

export function normalizeNickname(nickname: string) {
  return nickname.trim().replace(/\s+/g, " ").slice(0, 24);
}

export function normalizeAnswer(answer: string) {
  return answer.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function randomInitials() {
  return INITIAL_SEEDS[Math.floor(Math.random() * INITIAL_SEEDS.length)];
}

export function randomMatchup() {
  const firstIndex = Math.floor(Math.random() * TEAM_DATABASE.length);
  let secondIndex = Math.floor(Math.random() * TEAM_DATABASE.length);

  while (secondIndex === firstIndex) {
    secondIndex = Math.floor(Math.random() * TEAM_DATABASE.length);
  }

  return {
    teamA: TEAM_DATABASE[firstIndex],
    teamB: TEAM_DATABASE[secondIndex],
  };
}

export function secondsFromNow(seconds: number) {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

export function getAnswerVoteTotals(answerId: string, votes: Vote[]) {
  return votes.reduce(
    (totals, vote) => {
      if (vote.answer_id !== answerId) {
        return totals;
      }

      if (vote.vote === "accept") {
        totals.accept += 1;
      } else {
        totals.reject += 1;
      }

      return totals;
    },
    { accept: 0, reject: 0 },
  );
}

export function isAcceptedByMajority(answerId: string, votes: Vote[], eligibleVoters: number) {
  const totals = getAnswerVoteTotals(answerId, votes);
  const majority = Math.floor(eligibleVoters / 2) + 1;

  return totals.accept >= majority;
}

export function groupAnswersByPlayer(players: Player[], answers: Answer[]) {
  return players.map((player) => ({
    player,
    answers: answers.filter((answer) => answer.player_id === player.id),
  }));
}
