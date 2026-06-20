import { getErrorMessage, getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { closeRoom } from "@/lib/server/room-service";

type CloseRoomBody = {
  playerId?: string;
  sessionToken?: string;
};

export async function DELETE(request: Request, context: RouteContext<"/api/rooms/[code]">) {
  try {
    enforceRateLimit(request, { key: "rooms:close", limit: 20, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<CloseRoomBody>(request);

    await closeRoom(code, body?.playerId ?? "", body?.sessionToken ?? "");

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Could not close room."), getErrorStatus(error));
  }
}
