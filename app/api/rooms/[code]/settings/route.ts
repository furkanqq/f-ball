import { jsonError, readJson } from "@/lib/api-response";
import { updateSettings } from "@/lib/server/room-service";
import type { GameMode } from "@/lib/types";

type SettingsBody = {
  playerId?: string;
  gameMode?: GameMode;
  targetScore?: number;
};

export async function PATCH(request: Request, context: RouteContext<"/api/rooms/[code]/settings">) {
  try {
    const { code } = await context.params;
    const body = await readJson<SettingsBody>(request);

    if (body?.gameMode !== "initials" && body?.gameMode !== "team-battle" && body?.gameMode !== "imposter") {
      return jsonError("Choose a valid game mode.");
    }

    const room = await updateSettings(code, body?.playerId ?? "", body.gameMode, Number(body?.targetScore));

    return Response.json({ room });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not update settings.");
  }
}
