"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type CountdownTimerProps = {
  phaseEndsAt: string | null;
  maxSeconds?: number;
  children: (secondsLeft: number) => ReactNode;
};

type PhaseAutoAdvanceProps = {
  active: boolean;
  phaseKey: string;
  phaseEndsAt: string | null;
  onAdvance: () => void;
};

export function CountdownTimer({ phaseEndsAt, maxSeconds, children }: CountdownTimerProps) {
  const secondsLeft = useSecondsLeft(phaseEndsAt);
  const displaySeconds = maxSeconds === undefined ? secondsLeft : Math.min(secondsLeft, maxSeconds);

  return children(displaySeconds);
}

export function PhaseAutoAdvance({ active, phaseKey, phaseEndsAt, onAdvance }: PhaseAutoAdvanceProps) {
  const advancedPhaseRef = useRef("");

  useEffect(() => {
    if (!active || !phaseEndsAt) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        if (advancedPhaseRef.current === phaseKey) {
          return;
        }

        advancedPhaseRef.current = phaseKey;
        onAdvance();
      },
      Math.max(0, new Date(phaseEndsAt).getTime() - Date.now()),
    );

    return () => window.clearTimeout(timeout);
  }, [active, onAdvance, phaseEndsAt, phaseKey]);

  return null;
}

function useSecondsLeft(phaseEndsAt: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(() => getSecondsLeft(phaseEndsAt));

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSecondsLeft(getSecondsLeft(phaseEndsAt));
    }, 250);

    return () => window.clearInterval(interval);
  }, [phaseEndsAt]);

  return secondsLeft;
}

function getSecondsLeft(phaseEndsAt: string | null) {
  if (!phaseEndsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((new Date(phaseEndsAt).getTime() - Date.now()) / 1000));
}
