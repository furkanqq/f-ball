import { getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { joinRoom } from "@/lib/server/room-service";

type JoinRoomBody = {
  code?: string;
  nickname?: string;
};

export async function POST(request: Request) {
  try {
    enforceRateLimit(request, { key: "rooms:join", limit: 20, windowMs: 60_000 });
    const body = await readJson<JoinRoomBody>(request);
    const result = await joinRoom(body?.code ?? "", body?.nickname ?? "");

    return Response.json(result);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not join room.", getErrorStatus(error));
  }
}
