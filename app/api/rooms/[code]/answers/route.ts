import { jsonError, readJson } from "@/lib/api-response";
import { deleteAnswer, submitAnswer } from "@/lib/server/room-service";

type AnswerBody = {
  playerId?: string;
  text?: string;
};

type DeleteBody = {
  playerId?: string;
  answerId?: string;
};

export async function POST(request: Request, context: RouteContext<"/api/rooms/[code]/answers">) {
  try {
    const { code } = await context.params;
    const body = await readJson<AnswerBody>(request);
    const answer = await submitAnswer(code, body?.playerId ?? "", body?.text ?? "");

    return Response.json({ answer });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not submit answer.");
  }
}

export async function DELETE(request: Request, context: RouteContext<"/api/rooms/[code]/answers">) {
  try {
    const { code } = await context.params;
    const body = await readJson<DeleteBody>(request);
    await deleteAnswer(code, body?.playerId ?? "", body?.answerId ?? "");

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Could not delete answer.");
  }
}
