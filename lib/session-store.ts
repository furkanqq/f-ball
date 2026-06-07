"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type SessionState = {
  playerId: string | null;
  nickname: string;
  roomCode: string | null;
  setSession: (session: { playerId: string; nickname: string; roomCode: string }) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      playerId: null,
      nickname: "",
      roomCode: null,
      setSession: (session) =>
        set({
          playerId: session.playerId,
          nickname: session.nickname,
          roomCode: session.roomCode,
        }),
      clearSession: () => set({ playerId: null, nickname: "", roomCode: null }),
    }),
    {
      name: "football-party-session",
    },
  ),
);
