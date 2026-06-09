import { getErrorMessage, getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { finalizeRound } from "@/lib/server/room-service";

type FinalizeBody = {
  playerId?: string;
  sessionToken?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/finalize">) {
  try {
    enforceRateLimit(request, { key: "rooms:finalize", limit: 30, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<FinalizeBody>(request);
    const result = await finalizeRound(code, body?.playerId ?? "", body?.sessionToken ?? "");

    return Response.json(result);
  } catch (error) {
    return jsonError(getErrorMessage(error, "Could not finalize round."), getErrorStatus(error));
  }
}
