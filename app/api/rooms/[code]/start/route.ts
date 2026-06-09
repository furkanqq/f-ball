import { getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { startGame } from "@/lib/server/room-service";

type StartBody = {
  playerId?: string;
  sessionToken?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/start">) {
  try {
    enforceRateLimit(request, { key: "rooms:start", limit: 60, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<StartBody>(request);
    const room = await startGame(code, body?.playerId ?? "", body?.sessionToken ?? "");

    return Response.json({ room });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not start game.", getErrorStatus(error));
  }
}
