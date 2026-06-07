import { getErrorMessage, jsonError, readJson } from "@/lib/api-response";
import { awardFiveTeamScores, awardPoint } from "@/lib/server/room-service";

type ScoreBody = {
  playerId?: string;
  targetPlayerId?: string;
  points?: number;
  scores?: { playerId?: string; points?: number }[];
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/score">) {
  try {
    const { code } = await context.params;
    const body = await readJson<ScoreBody>(request);

    if (Array.isArray(body?.scores)) {
      await awardFiveTeamScores(
        code,
        body?.playerId ?? "",
        body.scores.map((score) => ({ playerId: score.playerId ?? "", points: Number(score.points) })),
      );
    } else {
      await awardPoint(code, body?.playerId ?? "", body?.targetPlayerId ?? "", Number(body?.points ?? 1));
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Could not award point."));
  }
}
