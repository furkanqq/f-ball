"use client";

import Image from "next/image";
import Link from "next/link";
import { LanguageToggle } from "@/components/language-toggle";
import { SiteFooter } from "@/components/site-footer";
import { useTranslation } from "@/lib/language-store";

type LegalPageProps = {
  type: "terms" | "privacy";
};

export function LegalPage({ type }: LegalPageProps) {
  const t = useTranslation();
  const title = type === "terms" ? t.legal.termsTitle : t.legal.privacyTitle;
  const intro = type === "terms" ? t.legal.termsIntro : t.legal.privacyIntro;
  const sections = t.legal.sections[type];

  return (
    <main className="flex min-h-screen flex-col bg-[#07120d] text-white">
      <section className="relative isolate flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.18),transparent_28%),linear-gradient(135deg,#07120d_0%,#101612_52%,#17251b_100%)]" />
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
          <header className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex items-center">
              <Image
                src="/logo/horizontal-logo.png"
                alt="F-Ball"
                width={160}
                height={62}
                priority
                className="h-16 w-auto object-contain"
              />
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="hidden h-10 items-center rounded-md border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-zinc-200 transition hover:bg-white/[0.1] sm:inline-flex"
              >
                {t.common.home}
              </Link>
              <LanguageToggle />
            </div>
          </header>

          <article className="rounded-lg border border-white/10 bg-black/30 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-300">{t.legal.updated}</p>
            <h1 className="mt-3 text-4xl font-black leading-tight sm:text-5xl">{title}</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">{intro}</p>

            <div className="mt-8 grid gap-5">
              {sections.map((section) => (
                <section key={section.title} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                  <h2 className="text-xl font-black text-white">{section.title}</h2>
                  <p className="mt-2 leading-7 text-zinc-300">{section.body}</p>
                </section>
              ))}
            </div>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
