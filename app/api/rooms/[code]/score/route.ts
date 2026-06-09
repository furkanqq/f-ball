import { getErrorMessage, getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { awardFiveTeamScores, awardPoint, undoScoreBatch } from "@/lib/server/room-service";

type ScoreBody = {
  playerId?: string;
  sessionToken?: string;
  targetPlayerId?: string;
  points?: number;
  scores?: { playerId?: string; points?: number }[];
  batchId?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/score">) {
  try {
    enforceRateLimit(request, { key: "rooms:score", limit: 60, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<ScoreBody>(request);

    if (Array.isArray(body?.scores)) {
      await awardFiveTeamScores(
        code,
        body?.playerId ?? "",
        body?.sessionToken ?? "",
        body.scores.map((score) => ({ playerId: score.playerId ?? "", points: Number(score.points) })),
      );
    } else {
      await awardPoint(code, body?.playerId ?? "", body?.sessionToken ?? "", body?.targetPlayerId ?? "", Number(body?.points ?? 1));
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Could not award point."), getErrorStatus(error));
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/rooms/[code]/score">) {
  try {
    enforceRateLimit(request, { key: "rooms:score:undo", limit: 60, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<ScoreBody>(request);

    await undoScoreBatch(code, body?.playerId ?? "", body?.sessionToken ?? "", body?.batchId);

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Could not undo score change."), getErrorStatus(error));
  }
}
