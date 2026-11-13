import path from "node:path";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildNda } from "@/lib/nda/build";
import { defaultNdaData } from "@/lib/nda/model";
import { standardTerms } from "@/lib/nda/terms";
import { NdaPdf, registerPdfFonts } from "./NdaPdf";

describe("NdaPdf", () => {
  it("renders the full NDA, including non-Latin names, to a multi-page PDF", async () => {
    registerPdfFonts(path.join(process.cwd(), "public", "fonts"));
    const data = defaultNdaData("2026-11-12");
    data.parties[0].name = "Łukasz Ołdakowski";
    data.parties[1].company = "ООО «Ромашка»";
    const blocks = buildNda(data, standardTerms);
    const pdf = await renderToBuffer(<NdaPdf blocks={blocks} />);

    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(2);
  }, 30_000);
});
