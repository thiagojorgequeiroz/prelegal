import { defaultNdaData, type Block, type NdaData, type Run } from "@/lib/nda/model";

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
