"use client";

import Image from "next/image";
import { useLanguageStore, useTranslation } from "@/lib/language-store";
import type { Language } from "@/lib/i18n";

const LANGUAGES: Language[] = ["tr", "en"];
const FLAGS: Record<Language, string> = {
  tr: "/flag-turkey.svg",
  en: "/flag-uk.svg",
};

export function LanguageToggle() {
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const t = useTranslation();

  return (
    <div
      className="inline-flex h-10 items-center rounded-md border border-white/10 bg-white/[0.05] p-1 text-xs font-black text-white sm:h-11"
      aria-label={t.language.label}
    >
      {LANGUAGES.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLanguage(item)}
          aria-label={t.language[item]}
          className={`grid h-8 w-10 place-items-center rounded transition sm:h-9 sm:w-11 ${
            language === item ? "bg-emerald-300 text-emerald-950" : "text-zinc-300 hover:bg-white/[0.08] hover:text-white"
          }`}
        >
          <Image src={FLAGS[item]} alt={t.language[item]} width={24} height={18} className="h-[18px] w-6 rounded-sm object-cover" />
        </button>
      ))}
    </div>
  );
}
