"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Language } from "@/lib/i18n";
import { translations } from "@/lib/i18n";

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
};

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      language: "tr",
      setLanguage: (language) => set({ language }),
    }),
    {
      name: "football-party-language",
    },
  ),
);

export function useTranslation() {
  const language = useLanguageStore((state) => state.language);
  return translations[language];
}
