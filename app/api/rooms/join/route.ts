import { jsonError, readJson } from "@/lib/api-response";
import { joinRoom } from "@/lib/server/room-service";

type JoinRoomBody = {
  code?: string;
  nickname?: string;
};

export async function POST(request: Request) {
  try {
    const body = await readJson<JoinRoomBody>(request);
    const result = await joinRoom(body?.code ?? "", body?.nickname ?? "");

    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not join room.");
  }
}
