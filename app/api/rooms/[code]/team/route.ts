import { getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { generateTeamMatchup } from "@/lib/server/room-service";

type TeamBody = {
  playerId?: string;
  sessionToken?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/team">) {
  try {
    enforceRateLimit(request, { key: "rooms:team", limit: 60, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<TeamBody>(request);
    const room = await generateTeamMatchup(code, body?.playerId ?? "", body?.sessionToken ?? "");

    return Response.json({ room });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not generate matchup.", getErrorStatus(error));
  }
}
