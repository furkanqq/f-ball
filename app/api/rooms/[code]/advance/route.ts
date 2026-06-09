import { getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { advancePhase } from "@/lib/server/room-service";

type AdvanceBody = {
  playerId?: string;
  sessionToken?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/advance">) {
  try {
    enforceRateLimit(request, { key: "rooms:advance", limit: 60, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<AdvanceBody>(request);
    const room = await advancePhase(code, body?.playerId ?? "", body?.sessionToken ?? "");

    return Response.json({ room });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not advance phase.", getErrorStatus(error));
  }
}
