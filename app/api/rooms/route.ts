import { getErrorMessage, getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createRoom } from "@/lib/server/room-service";

type CreateRoomBody = {
  nickname?: string;
};

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, { key: "rooms:create", limit: 8, windowMs: 60_000 });
    const body = await readJson<CreateRoomBody>(request);
    const result = await createRoom(body?.nickname ?? "");

    return Response.json(result);
  } catch (error) {
    return jsonError(getErrorMessage(error, "Could not create room."), getErrorStatus(error));
  }
}
