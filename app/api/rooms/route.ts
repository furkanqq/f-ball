import { getErrorMessage, jsonError, readJson } from "@/lib/api-response";
import { createRoom } from "@/lib/server/room-service";

type CreateRoomBody = {
  nickname?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<CreateRoomBody>(request);
    const result = await createRoom(body?.nickname ?? "");

    return Response.json(result);
  } catch (error) {
    return jsonError(getErrorMessage(error, "Could not create room."));
  }
}
