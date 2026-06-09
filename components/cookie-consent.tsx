"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { useTranslation } from "@/lib/language-store";

const CONSENT_KEY = "football-party-cookie-consent";
const CONSENT_COOKIE = "fball_cookie_consent=accepted; max-age=31536000; path=/; SameSite=Lax";
const CONSENT_EVENT = "fball-cookie-consent-change";

export function CookieConsent() {
  const t = useTranslation();
  const visible = useSyncExternalStore(subscribeToConsent, getConsentSnapshot, () => false);

  function acceptConsent() {
    window.localStorage.setItem(CONSENT_KEY, "accepted");
    document.cookie = CONSENT_COOKIE;
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6">
      <div className="mx-auto grid max-w-4xl gap-3 rounded-lg border border-emerald-300/25 bg-[#07120d]/95 p-4 text-white shadow-2xl shadow-black/40 backdrop-blur sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="grid h-10 w-10 place-items-center rounded-md bg-emerald-300/10 text-emerald-200">
          <Cookie size={20} />
        </div>
        <div>
          <h2 className="font-black">{t.cookie.title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-300">
            {t.cookie.body}{" "}
            <Link className="font-bold text-emerald-300 transition hover:text-emerald-200" href="/privacy">
              {t.cookie.privacyLink}
            </Link>
          </p>
        </div>
        <button
          type="button"
          onClick={acceptConsent}
          className="h-11 rounded-md bg-emerald-400 px-5 font-black text-emerald-950 transition hover:bg-emerald-300"
        >
          {t.cookie.accept}
        </button>
      </div>
    </div>
  );
}

function subscribeToConsent(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(CONSENT_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(CONSENT_EVENT, onStoreChange);
  };
}

function getConsentSnapshot() {
  return window.localStorage.getItem(CONSENT_KEY) !== "accepted";
}
