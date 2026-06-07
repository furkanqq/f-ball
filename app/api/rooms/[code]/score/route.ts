import { jsonError, readJson } from "@/lib/api-response";
import { awardPoint } from "@/lib/server/room-service";

type ScoreBody = {
  playerId?: string;
  targetPlayerId?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/score">) {
  try {
    const { code } = await context.params;
    const body = await readJson<ScoreBody>(request);
    await awardPoint(code, body?.playerId ?? "", body?.targetPlayerId ?? "");

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not award point.");
  }
}
