import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { NdaBuilder } from "@/components/NdaBuilder";
import { standardTerms } from "@/lib/nda/terms";

export const metadata: Metadata = {
  title: "Mutual NDA Creator · Prelegal",
  description: "Draft a Common Paper Mutual Non-Disclosure Agreement and download it as a PDF.",
};

export default function NdaPage() {
  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-t-4 border-b border-t-accent border-b-stone-200 bg-white px-6">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-xl font-bold text-navy">Prelegal</span>
          <span className="text-sm whitespace-nowrap text-stone-600">Mutual NDA Creator</span>
        </div>
        <div className="flex items-center gap-5">
          <a
            href="https://commonpaper.com/standards/mutual-nda/1.0"
            target="_blank"
            rel="noreferrer"
            className="hidden text-xs text-stone-600 hover:text-navy sm:block"
          >
            Based on Common Paper Mutual NDA v1.0
          </a>
          <Link href="/" className="text-sm font-medium text-navy hover:underline">
            Sign out
          </Link>
        </div>
      </header>
      <main className="flex flex-1 flex-col lg:min-h-0">
        {/* The builder defaults the effective date to the visitor's "today",
            so it must render per visit rather than at build time. */}
        <Suspense fallback={<p className="p-6 text-sm text-stone-600">Loading…</p>}>
          <NdaBuilder terms={standardTerms} />
        </Suspense>
      </main>
    </>
  );
}
