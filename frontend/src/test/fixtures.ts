import { vi } from "vitest";
import { defaultNdaData, type Block, type NdaData, type Run } from "@/lib/nda/model";

/** Stubs `fetch` so each `/api/chat` call answers with the next NDA. */
export function stubChat(...ndas: NdaData[]) {
  const fetchMock = vi.fn<typeof fetch>();
  for (const nda of ndas) {
    fetchMock.mockResolvedValueOnce(Response.json({ reply: "Updated.", nda }));
  }
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The JSON body of the n-th `fetch` call. */
export function requestBody(fetchMock: ReturnType<typeof vi.fn<typeof fetch>>, n = 0) {
  return JSON.parse(fetchMock.mock.calls[n][1]!.body as string);
}

/** A fully completed form, as a user would submit it. */
export function completedNda(overrides: Partial<NdaData> = {}): NdaData {
  return {
    ...defaultNdaData("2026-11-12"),
    governingLaw: "Delaware",
    jurisdiction: "New Castle, DE",
    parties: [
      { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "legal@acme.test" },
      { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "1 Main St, Springfield" },
    ],
    ...overrides,
  };
}

/** All inline runs of paragraphs and numbered clauses, in document order. */
export function runsOf(blocks: Block[]): Run[] {
  return blocks.flatMap((b) => (b.kind === "paragraph" || b.kind === "numbered" ? b.runs : []));
}

/** Plain text of a document: one line per block, signature values space-separated. */
export function textOf(blocks: Block[]): string {
  return blocks
    .map((b) => {
      switch (b.kind) {
        case "heading":
          return b.text;
        case "paragraph":
        case "numbered":
          return b.runs.map((r) => r.text).join("");
        case "signatures":
          return b.rows.flatMap((r) => r.values.map((v) => v.text)).join(" ");
        case "pageBreak":
          return "";
      }
    })
    .join("\n");
}
