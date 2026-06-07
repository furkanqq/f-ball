import { jsonError, readJson } from "@/lib/api-response";
import { castVote } from "@/lib/server/room-service";
import type { VoteValue } from "@/lib/types";

type VoteBody = {
  playerId?: string;
  answerId?: string;
  vote?: VoteValue;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/votes">) {
  try {
    const { code } = await context.params;
    const body = await readJson<VoteBody>(request);

    if (body?.vote !== "accept" && body?.vote !== "reject") {
      return jsonError("Choose accept or reject.");
    }

    const vote = await castVote(code, body?.playerId ?? "", body?.answerId ?? "", body.vote);

    return Response.json({ vote });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not cast vote.");
  }
}
