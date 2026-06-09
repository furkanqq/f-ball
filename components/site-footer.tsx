"use client";

import Link from "next/link";
import { useTranslation } from "@/lib/language-store";

export function SiteFooter() {
  const t = useTranslation();
  const [before, after] = t.common.developedBy.split("f-solve");

  return (
    <footer className="relative shrink-0 border-t border-emerald-300/30 bg-transparent px-4 pb-2 pt-2 text-center text-xs text-zinc-500 sm:text-sm lg:pb-3 lg:pt-3">
      <div
        aria-hidden="true"
        className="absolute -top-16 hover:-top-15 transition-all cursor-pointer left-1/2 h-32 w-32 -translate-x-1/2 rounded-full border-t border-emerald-300/30 bg-[#07120d]/20"
      />
      <div className="relative flex flex-col items-center justify-center gap-1 sm:flex-row sm:gap-3">
        <span>
          {before}
          <Link
            className="font-semibold text-emerald-300 transition hover:text-emerald-200"
            href="https://www.f-solve.com/"
            target="_blank"
            rel="noreferrer"
          >
            f-solve
          </Link>
          {after}
        </span>
        <span className="hidden text-zinc-700 sm:inline">/</span>
        <span className="inline-flex items-center gap-3">
          <Link className="transition hover:text-emerald-200" href="/how-to-play">
            {t.common.howToPlay}
          </Link>
          <Link className="transition hover:text-emerald-200" href="/terms">
            {t.common.terms}
          </Link>
          <Link className="transition hover:text-emerald-200" href="/privacy">
            {t.common.privacy}
          </Link>
        </span>
      </div>
    </footer>
  );
}
