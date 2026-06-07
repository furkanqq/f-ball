import { jsonError, readJson } from "@/lib/api-response";
import { startGame } from "@/lib/server/room-service";

type StartBody = {
  playerId?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/start">) {
  try {
    const { code } = await context.params;
    const body = await readJson<StartBody>(request);
    const room = await startGame(code, body?.playerId ?? "");

    return Response.json({ room });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not start game.");
  }
}
