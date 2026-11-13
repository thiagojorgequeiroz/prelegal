import { describe, expect, it } from "vitest";
import type { Block } from "./model";
import { parseInline, parseTerms } from "./parse-terms";
import { standardTerms } from "./terms";

describe("parseInline", () => {
  it("returns plain text as a single run", () => {
    expect(parseInline("Just text.")).toEqual([{ text: "Just text." }]);
  });

  it("returns no runs for an empty string", () => {
    expect(parseInline("")).toEqual([]);
  });

  it("splits bold text, links and cover page references", () => {
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

  it("handles adjacent tokens without empty runs between them", () => {
    expect(parseInline('**A**<span class="coverpage_link">B</span>')).toEqual([
      { text: "A", bold: true },
      { text: "B", bold: true },
    ]);
  });

  it("parses several cover page references in one sentence", () => {
    const runs = parseInline(
      'laws of <span class="coverpage_link">Governing Law</span> and courts in <span class="coverpage_link">Jurisdiction</span>.',
    );
    expect(runs.filter((r) => r.bold).map((r) => r.text)).toEqual(["Governing Law", "Jurisdiction"]);
  });

  it("keeps bold text non-greedy", () => {
    expect(parseInline("**a** and **b**")).toEqual([
      { text: "a", bold: true },
      { text: " and " },
      { text: "b", bold: true },
    ]);
  });

  it("leaves unmatched markup as literal text", () => {
    expect(parseInline("a ** b")).toEqual([{ text: "a ** b" }]);
    expect(parseInline("[no link]")).toEqual([{ text: "[no link]" }]);
  });

  it("keeps curly quotes and other unicode intact", () => {
    expect(parseInline("(“**MNDA**”)")).toEqual([{ text: "(“" }, { text: "MNDA", bold: true }, { text: "”)" }]);
  });
});

describe("parseTerms", () => {
  it("parses headings, numbered clauses and trailing paragraphs", () => {
    const blocks = parseTerms("# Terms\n\n1. **One**. First.\n\n2. **Two**. Second.\n\nFooter.");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "numbered", "numbered", "paragraph"]);
  });

  it("supports heading levels 1 to 3", () => {
    const blocks = parseTerms("# A\n\n## B\n\n### C");
    expect(blocks).toEqual([
      { kind: "heading", level: 1, text: "A" },
      { kind: "heading", level: 2, text: "B" },
      { kind: "heading", level: 3, text: "C" },
    ]);
  });

  it("parses multi-digit clause numbers", () => {
    expect(parseTerms("10. Ten.\n\n11. Eleven.")).toEqual([
      { kind: "numbered", number: "10", runs: [{ text: "Ten." }] },
      { kind: "numbered", number: "11", runs: [{ text: "Eleven." }] },
    ]);
  });

  it("handles Windows line endings and extra blank lines", () => {
    const blocks = parseTerms("# T\r\n\r\n\r\n1. One.\r\n\r\n   \r\n2. Two.\r\n");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "numbered", "numbered"]);
  });

  it("returns nothing for empty input", () => {
    expect(parseTerms("")).toEqual([]);
    expect(parseTerms("\n\n  \n")).toEqual([]);
  });
});

describe("standardTerms (templates/Mutual-NDA.md)", () => {
  const clauses = standardTerms.filter((b): b is Extract<Block, { kind: "numbered" }> => b.kind === "numbered");
  const allRuns = standardTerms.flatMap((b) => ("runs" in b ? b.runs : []));

  it("starts with the Standard Terms heading", () => {
    expect(standardTerms[0]).toEqual({ kind: "heading", level: 1, text: "Standard Terms" });
  });

  it("contains clauses 1 to 11 in order", () => {
    expect(clauses.map((c) => c.number)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
  });

  it("starts every clause with its bold title", () => {
    const titles = clauses.map((c) => c.runs.find((r) => r.bold)?.text);
    expect(titles).toEqual([
      "Introduction",
      "Use and Protection of Confidential Information",
      "Exceptions",
      "Disclosures Required by Law",
      "Term and Termination",
      "Return or Destruction of Confidential Information",
      "Proprietary Rights",
      "Disclaimer",
      "Governing Law and Jurisdiction",
      "Equitable Relief",
      "General",
    ]);
  });

  it("leaves no raw markup in the text", () => {
    for (const run of allRuns) {
      expect(run.text).not.toMatch(/\*\*|<span|<\/span>|\]\(/);
    }
  });

  it("turns every cover page reference into a bold defined term", () => {
    const refs = new Set(
      allRuns.filter((r) => r.bold).map((r) => r.text),
    );
    for (const term of ["Purpose", "Effective Date", "MNDA Term", "Term of Confidentiality", "Governing Law", "Jurisdiction"]) {
      expect(refs).toContain(term);
    }
  });

  it("ends with the CC BY 4.0 attribution", () => {
    const last = standardTerms.at(-1);
    expect(last?.kind).toBe("paragraph");
    expect(last && "runs" in last && last.runs).toContainEqual({
      text: "CC BY 4.0",
      href: "https://creativecommons.org/licenses/by/4.0/",
    });
  });
});
