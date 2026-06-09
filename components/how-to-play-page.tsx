"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, CheckCircle2 } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { SiteFooter } from "@/components/site-footer";
import { useTranslation } from "@/lib/language-store";

export function HowToPlayPage() {
  const t = useTranslation();

  return (
    <main className="flex min-h-screen flex-col bg-[#07120d] text-white">
      <section className="relative isolate flex-1 px-4 py-5 sm:px-6 lg:px-8">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(34,197,94,0.18),transparent_28%),linear-gradient(135deg,#07120d_0%,#101612_52%,#17251b_100%)]" />
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
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

          <article className="grid gap-5">
            <div className="rounded-lg border border-white/10 bg-black/30 p-5 shadow-2xl shadow-black/30 backdrop-blur sm:p-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-100">
                <BookOpen size={16} />
                {t.common.howToPlay}
              </div>
              <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">{t.howToPlay.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">{t.howToPlay.intro}</p>
            </div>

            <section className="rounded-lg border border-white/10 bg-black/25 p-5 sm:p-6">
              <h2 className="text-2xl font-black">{t.howToPlay.stepsTitle}</h2>
              <div className="mt-4 grid gap-3">
                {t.howToPlay.steps.map((step, index) => (
                  <div key={step} className="grid grid-cols-[2.25rem_1fr] gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
                    <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-300/15 font-black text-emerald-200">
                      {index + 1}
                    </div>
                    <p className="leading-7 text-zinc-200">{step}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-white/10 bg-black/25 p-5 sm:p-6">
              <h2 className="text-2xl font-black">{t.howToPlay.modesTitle}</h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {t.howToPlay.modes.map((mode) => (
                  <div key={mode.title} className="rounded-md border border-white/10 bg-white/[0.04] p-4">
                    <h3 className="text-lg font-black text-white">{mode.title}</h3>
                    <p className="mt-2 leading-7 text-zinc-300">{mode.body}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-5 sm:p-6">
              <h2 className="text-2xl font-black">{t.howToPlay.tipsTitle}</h2>
              <div className="mt-4 grid gap-3">
                {t.howToPlay.tips.map((tip) => (
                  <div key={tip} className="flex gap-3 text-zinc-100">
                    <CheckCircle2 className="mt-1 shrink-0 text-emerald-300" size={18} />
                    <p className="leading-7">{tip}</p>
                  </div>
                ))}
              </div>
            </section>
          </article>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
