import { Suspense } from "react";
import { NdaBuilder } from "@/components/NdaBuilder";
import { standardTerms } from "@/lib/nda/terms";

export default function Home() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-stone-200 bg-white px-6">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-xl font-bold text-stone-900">Prelegal</span>
          <span className="text-sm whitespace-nowrap text-stone-500">Mutual NDA Creator</span>
        </div>
        <a
          href="https://commonpaper.com/standards/mutual-nda/1.0"
          target="_blank"
          rel="noreferrer"
          className="hidden text-xs text-stone-500 hover:text-stone-800 sm:block"
        >
          Based on Common Paper Mutual NDA v1.0
        </a>
      </header>
      <main className="flex flex-1 flex-col lg:min-h-0">
        {/* The builder defaults the effective date to the visitor's "today",
            so it must render per visit rather than at build time. */}
        <Suspense fallback={<p className="p-6 text-sm text-stone-500">Loading…</p>}>
          <NdaBuilder terms={standardTerms} />
        </Suspense>
      </main>
    </>
  );
}
