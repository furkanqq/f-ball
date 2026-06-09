import { getErrorMessage, getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { updateSettings } from "@/lib/server/room-service";
import type { GameMode } from "@/lib/types";

type SettingsBody = {
  playerId?: string;
  sessionToken?: string;
  gameMode?: GameMode;
  targetScore?: number;
  fiveTeamSeconds?: number;
};

export async function PATCH(request: Request, context: RouteContext<"/api/rooms/[code]/settings">) {
  try {
    enforceRateLimit(request, { key: "rooms:settings", limit: 60, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<SettingsBody>(request);

    if (
      body?.gameMode !== "initials" &&
      body?.gameMode !== "team-battle" &&
      body?.gameMode !== "imposter" &&
      body?.gameMode !== "five-teams"
    ) {
      return jsonError("Choose a valid game mode.");
    }

    const room = await updateSettings(
      code,
      body?.playerId ?? "",
      body?.sessionToken ?? "",
      body.gameMode,
      Number(body?.targetScore),
      body?.fiveTeamSeconds === undefined ? undefined : Number(body.fiveTeamSeconds),
    );

    return Response.json({ room });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Could not update settings."), getErrorStatus(error));
  }
}
