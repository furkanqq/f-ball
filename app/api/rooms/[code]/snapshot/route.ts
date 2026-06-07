import { jsonError } from "@/lib/api-response";
import { getRoomSnapshot } from "@/lib/server/room-service";

export async function GET(_request: Request, context: RouteContext<"/api/rooms/[code]/snapshot">) {
  try {
    const { code } = await context.params;
    const snapshot = await getRoomSnapshot(code);

    if (!snapshot) {
      return jsonError("Room not found.", 404);
    }

    return Response.json(snapshot);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not load room.", 500);
  }
}
