import { jsonError, readJson } from "@/lib/api-response";
import { generateTeamMatchup } from "@/lib/server/room-service";

type TeamBody = {
  playerId?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/team">) {
  try {
    const { code } = await context.params;
    const body = await readJson<TeamBody>(request);
    const room = await generateTeamMatchup(code, body?.playerId ?? "");

    return Response.json({ room });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not generate matchup.");
  }
}
