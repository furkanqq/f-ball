import { jsonError, readJson } from "@/lib/api-response";
import { finalizeRound } from "@/lib/server/room-service";

type FinalizeBody = {
  playerId?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/finalize">) {
  try {
    const { code } = await context.params;
    const body = await readJson<FinalizeBody>(request);
    const result = await finalizeRound(code, body?.playerId ?? "");

    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not finalize round.");
  }
}
