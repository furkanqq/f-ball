import { getErrorStatus, jsonError, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { deleteAnswer, submitAnswer } from "@/lib/server/room-service";

type AnswerBody = {
  playerId?: string;
  sessionToken?: string;
  text?: string;
};

type DeleteBody = {
  playerId?: string;
  sessionToken?: string;
  answerId?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/answers">) {
  try {
    enforceRateLimit(request, { key: "rooms:answers", limit: 60, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<AnswerBody>(request);
    const answer = await submitAnswer(code, body?.playerId ?? "", body?.sessionToken ?? "", body?.text ?? "");

    return Response.json({ answer });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not submit answer.", getErrorStatus(error));
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/rooms/[code]/answers">) {
  try {
    enforceRateLimit(request, { key: "rooms:answers:delete", limit: 60, windowMs: 60_000 });
    const { code } = await context.params;
    const body = await readJson<DeleteBody>(request);
    await deleteAnswer(code, body?.playerId ?? "", body?.sessionToken ?? "", body?.answerId ?? "");

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not delete answer.", getErrorStatus(error));
  }
}
