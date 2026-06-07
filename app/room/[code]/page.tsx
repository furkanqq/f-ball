import { RoomClient } from "@/components/room-client";
import { normalizeRoomCode } from "@/lib/game-utils";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;

  return <RoomClient code={normalizeRoomCode(code)} />;
}
