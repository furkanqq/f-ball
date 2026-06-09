"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Trophy } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { SiteFooter } from "@/components/site-footer";
import { normalizeRoomCode } from "@/lib/game-utils";
import { useTranslation } from "@/lib/language-store";
import { useSessionStore } from "@/lib/session-store";
import type { ApiError, Player, Room } from "@/lib/types";

type RoomResponse = {
  room: Room;
  player: Player;
  sessionToken: string;
};

export function HomePage() {
  const router = useRouter();
  const t = useTranslation();
  const setSession = useSessionStore((state) => state.setSession);
  const [createNickname, setCreateNickname] = useState("");
  const [joinNickname, setJoinNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [busyAction, setBusyAction] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("create");
    setError("");

    const result = await postRoom("/api/rooms", { nickname: createNickname });
    setBusyAction(null);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSession({
      playerId: result.player.id,
      sessionToken: result.sessionToken,
      nickname: result.player.nickname,
      roomCode: result.room.code,
    });
    router.push(`/room/${result.room.code}`);
  }

  async function submitJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyAction("join");
    setError("");

    const result = await postRoom("/api/rooms/join", {
      nickname: joinNickname,
      code: normalizeRoomCode(roomCode),
    });
    setBusyAction(null);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSession({
      playerId: result.player.id,
      sessionToken: result.sessionToken,
      nickname: result.player.nickname,
      roomCode: result.room.code,
    });
    router.push(`/room/${result.room.code}`);
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#07120d] text-white">
      <section className="relative isolate flex flex-1 items-center px-4 py-5 sm:px-6 lg:min-h-0 lg:px-8 lg:py-4">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.22),transparent_28%),linear-gradient(135deg,#07120d_0%,#101612_52%,#17251b_100%)]" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-2/5 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />

        <div className="mx-auto grid w-full max-w-6xl gap-5 lg:gap-8 lg:grid-cols-[1fr_460px] lg:items-center">
          <div className="order-2 space-y-5 lg:order-1 lg:space-y-7">
            <div className="flex w-full items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                <Image
                  src="/logo/horizontal-logo.png"
                  alt="F-Ball"
                  width={220}
                  height={86}
                  priority
                  className="h-20 w-auto shrink-0 object-contain sm:h-24 lg:h-28"
                />
                <div className="hidden items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-medium text-emerald-100 sm:inline-flex">
                  <Trophy size={16} />
                  {t.home.badge}
                </div>
              </div>
              <LanguageToggle />
            </div>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-black leading-[0.95] tracking-normal text-white sm:text-5xl lg:text-6xl xl:text-7xl">
                {t.home.title}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-zinc-300 sm:text-lg sm:leading-8 xl:text-xl">
                {t.home.subtitle}
              </p>
            </div>

            <div className="hidden max-w-2xl grid-cols-2 gap-3 text-sm text-zinc-200 sm:grid sm:grid-cols-3">
              <Stat label={t.home.statPlayers} value="2-8" />
              <Stat label={t.home.statModes} value="4" />
              <Stat label={t.home.statLogin} value={t.home.noLogin} />
            </div>
          </div>

          <div className="order-1 rounded-lg border border-white/10 bg-black/30 p-4 shadow-2xl shadow-black/30 backdrop-blur sm:p-5 lg:order-2 xl:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">{t.home.roomSetup}</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {t.home.roomSetupHint}
                </p>
              </div>
              <Image
                src="/logo/logo.png"
                alt="F-Ball"
                width={44}
                height={44}
                className="h-11 w-11 object-contain"
              />
            </div>

            {error ? (
              <div className="mb-4 rounded-md border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <div className="grid gap-4">
              <form
                onSubmit={submitCreate}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-4"
              >
                <label
                  className="text-sm font-semibold text-zinc-200"
                  htmlFor="create-nickname"
                >
                  {t.home.nickname}
                </label>
                <input
                  id="create-nickname"
                  value={createNickname}
                  onChange={(event) => setCreateNickname(event.target.value)}
                  maxLength={24}
                  className="mt-2 h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-base text-white outline-none transition focus:border-emerald-300"
                  placeholder={t.home.hostNickname}
                />
                <button
                  type="submit"
                  disabled={busyAction !== null}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-400 px-4 font-bold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Plus size={18} />
                  {busyAction === "create"
                    ? t.home.creating
                    : t.home.createRoom}
                </button>
              </form>

              <form
                onSubmit={submitJoin}
                className="rounded-lg border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <div>
                    <label
                      className="text-sm font-semibold text-zinc-200"
                      htmlFor="join-nickname"
                    >
                      {t.home.nickname}
                    </label>
                    <input
                      id="join-nickname"
                      value={joinNickname}
                      onChange={(event) => setJoinNickname(event.target.value)}
                      maxLength={24}
                      className="mt-2 h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-base text-white outline-none transition focus:border-emerald-300"
                      placeholder={t.home.playerNickname}
                    />
                  </div>
                  <div>
                    <label
                      className="text-sm font-semibold text-zinc-200"
                      htmlFor="room-code"
                    >
                      {t.home.roomCode}
                    </label>
                    <input
                      id="room-code"
                      value={roomCode}
                      onChange={(event) =>
                        setRoomCode(normalizeRoomCode(event.target.value))
                      }
                      maxLength={6}
                      className="mt-2 h-12 w-full rounded-md border border-white/10 bg-black/30 px-4 text-center font-mono text-lg uppercase tracking-[0.18em] text-white outline-none transition focus:border-emerald-300"
                      placeholder="ABC123"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={busyAction !== null}
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md border border-emerald-300/40 bg-emerald-300/10 px-4 font-bold text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busyAction === "join" ? t.home.joining : t.home.joinRoom}
                  <ArrowRight size={18} />
                </button>
              </form>
            </div>
            <Link
              href="/how-to-play"
              className="mt-4 inline-flex w-full items-center justify-center rounded-md border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.08] hover:text-white"
            >
              {t.common.howToPlay}
            </Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-4">
      <div className="text-2xl font-black text-emerald-300">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-zinc-400">
        {label}
      </div>
    </div>
  );
}

async function postRoom(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as RoomResponse | ApiError;

  return data;
}
