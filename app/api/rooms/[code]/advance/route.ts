import { jsonError, readJson } from "@/lib/api-response";
import { advancePhase } from "@/lib/server/room-service";

type AdvanceBody = {
  playerId?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/advance">) {
  try {
    const { code } = await context.params;
    const body = await readJson<AdvanceBody>(request);
    const room = await advancePhase(code, body?.playerId ?? "");

    return Response.json({ room });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not advance phase.");
  }
}
