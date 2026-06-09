import { getErrorStatus, jsonError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getRoomSnapshot } from "@/lib/server/room-service";

export async function GET(request: Request, context: RouteContext<"/api/rooms/[code]/snapshot">) {
  try {
    enforceRateLimit(request, { key: "rooms:snapshot", limit: 240, windowMs: 60_000 });
    const { code } = await context.params;
    const playerId = new URL(request.url).searchParams.get("playerId");
    const sessionToken = request.headers.get("x-fball-session-token");
    const snapshot = await getRoomSnapshot(code, { scope: "client", playerId, sessionToken });

    if (!snapshot) {
      return jsonError("Room not found.", 404);
    }

    return Response.json(snapshot);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load room.", getErrorStatus(error, 500));
  }
}
