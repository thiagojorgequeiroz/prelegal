import { describe, expect, it } from "vitest";
import { buildNda, formatDate } from "./build";
import { defaultNdaData, type Block, type NdaData } from "./model";
import { parseInline, parseTerms } from "./parse-terms";
import { standardTerms } from "./terms";

const text = (blocks: Block[]) =>
  blocks
    .map((b) => {
      if (b.kind === "paragraph" || b.kind === "numbered") return b.runs.map((r) => r.text).join("");
      if (b.kind === "heading") return b.text;
      if (b.kind === "signatures") return b.rows.flatMap((r) => r.values.map((v) => v.text)).join(" ");
      return "";
    })
    .join("\n");

const sample = (): NdaData => ({
  ...defaultNdaData("2026-11-12"),
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  parties: [
    { name: "Ada Lovelace", title: "CEO", company: "Acme Inc.", noticeAddress: "legal@acme.test" },
    { name: "Alan Turing", title: "CTO", company: "Globex LLC", noticeAddress: "1 Main St" },
  ],
});

describe("parseInline", () => {
  it("splits bold, links and cover page references", () => {
    expect(parseInline('a **B** <span class="coverpage_link">Purpose</span> [c](https://x.test).')).toEqual([
      { text: "a " },
      { text: "B", bold: true },
      { text: " " },
      { text: "Purpose", bold: true },
      { text: " " },
      { text: "c", href: "https://x.test" },
      { text: "." },
    ]);
  });
});

describe("parseTerms", () => {
  it("parses headings, numbered clauses and trailing paragraphs", () => {
    const blocks = parseTerms("# Terms\r\n\r\n1. **One**. First.\n\n2. **Two**. Second.\n\nFooter.");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "numbered", "numbered", "paragraph"]);
  });

  it("parses all 11 clauses of the real Standard Terms", () => {
    expect(standardTerms.filter((b) => b.kind === "numbered")).toHaveLength(11);
  });
});

describe("formatDate", () => {
  it("formats ISO dates without timezone drift", () => {
    expect(formatDate("2026-01-01")).toBe("January 1, 2026");
    expect(formatDate("")).toBe("");
    expect(formatDate("0002-11-12")).toBe(""); // year still being typed
  });
});

describe("buildNda", () => {
  it("fills in the cover page", () => {
    const out = text(buildNda(sample(), standardTerms));
    expect(out).toContain("Expires 1 year from Effective Date.");
    expect(out).toContain("Governing Law: Delaware");
    expect(out).toContain("Jurisdiction: courts located in New Castle, DE");
    expect(out).toContain("Effective Date\nNovember 12, 2026");
    expect(out).toContain("Acme Inc.");
    expect(out).toContain("Globex LLC");
  });

  it("keeps the Standard Terms verbatim, with Cover Page references as defined terms", () => {
    const out = text(buildNda(sample(), standardTerms));
    expect(out).toContain("the laws of the State of Governing Law, without regard");
    expect(out).toContain("commences on the Effective Date and expires");
    expect(out).not.toContain("coverpage_link");
    expect(out).not.toContain("Delaware)");
  });

  it("supports open-ended terms", () => {
    const data = { ...sample(), mndaTerm: { kind: "untilTerminated" }, confidentialityTerm: { kind: "perpetual" } } as const;
    const out = text(buildNda(data, standardTerms));
    expect(out).toContain("Continues until terminated in accordance with the terms of the MNDA.");
    expect(out).toContain("In perpetuity.");
  });

  it("marks blank fields as missing placeholders", () => {
    const blocks = buildNda(defaultNdaData("2026-11-12"), standardTerms);
    const runs = blocks.flatMap((b) => (b.kind === "paragraph" || b.kind === "numbered" ? b.runs : []));
    expect(runs).toContainEqual({ text: "[Governing Law]", missing: true });
  });
});
