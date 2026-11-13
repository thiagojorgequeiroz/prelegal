"use client";

import { useMemo, useState } from "react";
import { buildNda } from "@/lib/nda/build";
import { defaultNdaData, type Block, type NdaData } from "@/lib/nda/model";
import { pdfFileName, toIsoDate } from "@/lib/nda/utils";
import { ChatPanel } from "./ChatPanel";
import { NdaPreview } from "./NdaPreview";

async function downloadPdf(blocks: Block[], fileName: string) {
  // Loaded on demand: the PDF engine is large and only needed on click.
  const [{ pdf }, { NdaPdf, registerPdfFonts }] = await Promise.all([
    import("@react-pdf/renderer"),
    import("./NdaPdf"),
  ]);
  registerPdfFonts(`${window.location.origin}/fonts`);
  const blob = await pdf(<NdaPdf blocks={blocks} />).toBlob();

  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), { href: url, download: fileName });
  // Firefox and Safari need the link in the document, and the URL alive for
  // a moment after the click, to start the download reliably.
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Split view: the AI chat on the left, a live preview of the NDA on the right. */
export function NdaBuilder({ terms }: { terms: Block[] }) {
  const [data, setData] = useState<NdaData>(() => defaultNdaData(toIsoDate(new Date())));
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const blocks = useMemo(() => buildNda(data, terms), [data, terms]);

  async function handleDownload() {
    setDownloading(true);
    setError(null);
    try {
      await downloadPdf(blocks, pdfFileName(data));
    } catch (err) {
      console.error(err);
      setError("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="grid flex-1 lg:min-h-0 lg:grid-cols-[minmax(360px,440px)_1fr] lg:grid-rows-[minmax(0,1fr)]">
      <aside className="flex flex-col border-stone-200 bg-white p-6 lg:overflow-hidden lg:border-r">
        <h2 className="mb-1 text-lg font-semibold text-navy">Draft with AI</h2>
        <p className="mb-4 text-sm text-stone-600">
          Tell the assistant about your NDA. The document updates as you chat.
        </p>
        <ChatPanel data={data} onChange={setData} />
      </aside>

      <section className="flex flex-col bg-stone-100 lg:overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 bg-stone-50 px-6 py-3">
          <div>
            <h2 className="text-sm font-semibold text-navy">Preview</h2>
            <p className="text-xs text-stone-600">Highlighted text comes from your answers. Blanks print as lines to fill in.</p>
          </div>
          <div className="flex items-center gap-3">
            {error && (
              <p role="alert" className="text-sm text-red-700">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="rounded-md bg-secondary px-4 py-2 text-sm font-semibold whitespace-nowrap text-white shadow-sm hover:bg-secondary/90 disabled:cursor-wait disabled:opacity-60"
            >
              {downloading ? "Preparing…" : "Download PDF"}
            </button>
          </div>
        </div>
        <div className="flex-1 p-4 sm:p-8 lg:overflow-y-auto">
          <NdaPreview blocks={blocks} />
        </div>
      </section>
    </div>
  );
}
