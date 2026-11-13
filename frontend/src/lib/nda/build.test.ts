import { describe, expect, it } from "vitest";
import { completedNda, runsOf, textOf } from "@/test/fixtures";
import { buildNda, formatDate, pluralizeYears } from "./build";
import { defaultNdaData, type Block, type NdaData } from "./model";
import { standardTerms } from "./terms";

const build = (data: NdaData) => buildNda(data, standardTerms);
const signatures = (blocks: Block[]) =>
  blocks.find((b): b is Extract<Block, { kind: "signatures" }> => b.kind === "signatures")!;

describe("formatDate", () => {
  it.each([
    ["2026-11-12", "November 12, 2026"],
    ["2026-01-01", "January 1, 2026"],
    ["2026-12-31", "December 31, 2026"],
    ["2028-02-29", "February 29, 2028"],
  ])("formats %s as %s regardless of timezone", (iso, expected) => {
    expect(formatDate(iso)).toBe(expected);
  });

  it.each(["", "2026", "2026-11", "not-a-date", "0002-11-12", "0999-01-01"])(
    "returns an empty string for incomplete input %j",
    (iso) => {
      expect(formatDate(iso)).toBe("");
    },
  );
});

describe("pluralizeYears", () => {
  it.each([
    [1, "1 year"],
    [2, "2 years"],
    [10, "10 years"],
  ])("%i → %s", (n, expected) => {
    expect(pluralizeYears(n)).toBe(expected);
  });
});

describe("defaultNdaData", () => {
  it("matches the options pre-selected on the Common Paper cover page", () => {
    const data = defaultNdaData("2026-11-12");
    expect(data.purpose).toBe("Evaluating whether to enter into a business relationship with the other party.");
    expect(data.effectiveDate).toBe("2026-11-12");
    expect(data.mndaTerm).toEqual({ kind: "years", years: 1 });
    expect(data.confidentialityTerm).toEqual({ kind: "years", years: 1 });
  });

  it("creates two independent, empty parties", () => {
    const data = defaultNdaData("2026-11-12");
    expect(data.parties[0]).toEqual({ name: "", title: "", company: "", noticeAddress: "" });
    expect(data.parties[0]).not.toBe(data.parties[1]);
  });
});

describe("buildNda: document structure", () => {
  const blocks = build(completedNda());
  const breakAt = blocks.findIndex((b) => b.kind === "pageBreak");

  it("starts with the agreement title", () => {
    expect(blocks[0]).toEqual({ kind: "heading", level: 1, text: "Mutual Non-Disclosure Agreement" });
  });

  it("has the cover page sections in template order", () => {
    const headings = blocks.slice(0, breakAt).flatMap((b) => (b.kind === "heading" && b.level === 3 ? [b.text] : []));
    expect(headings).toEqual([
      "Purpose",
      "Effective Date",
      "MNDA Term",
      "Term of Confidentiality",
      "Governing Law & Jurisdiction",
      "MNDA Modifications",
    ]);
  });

  it("puts the Standard Terms, unchanged, after a single page break", () => {
    expect(blocks.filter((b) => b.kind === "pageBreak")).toHaveLength(1);
    expect(blocks.slice(breakAt + 1)).toEqual(standardTerms);
  });

  it("does not mutate its inputs", () => {
    const data = completedNda();
    const dataCopy = structuredClone(data);
    const termsCopy = structuredClone(standardTerms);
    build(data);
    expect(data).toEqual(dataCopy);
    expect(standardTerms).toEqual(termsCopy);
  });

  it("links to the published Standard Terms and the license", () => {
    const links = runsOf(blocks).filter((r) => r.href).map((r) => r.href);
    expect(links).toContain("https://commonpaper.com/standards/mutual-nda/1.0");
    expect(links).toContain("https://creativecommons.org/licenses/by/4.0/");
  });
});

describe("buildNda: cover page values", () => {
  it("fills in purpose, date, law and jurisdiction", () => {
    const out = textOf(build(completedNda()));
    expect(out).toContain("Purpose\nEvaluating whether to enter into a business relationship with the other party.");
    expect(out).toContain("Effective Date\nNovember 12, 2026");
    expect(out).toContain("Governing Law: Delaware");
    expect(out).toContain("Jurisdiction: courts located in New Castle, DE");
  });

  it("marks user-supplied values as filled", () => {
    const runs = runsOf(build(completedNda()));
    expect(runs).toContainEqual({ text: "Delaware", filled: true });
    expect(runs).toContainEqual({ text: "November 12, 2026", filled: true });
  });

  it.each([
    [{ kind: "years", years: 1 } as const, "Expires 1 year from Effective Date."],
    [{ kind: "years", years: 3 } as const, "Expires 3 years from Effective Date."],
    [{ kind: "untilTerminated" } as const, "Continues until terminated in accordance with the terms of the MNDA."],
  ])("words the MNDA term %j", (mndaTerm, expected) => {
    expect(textOf(build(completedNda({ mndaTerm })))).toContain(`MNDA Term\n${expected}`);
  });

  it.each([
    [{ kind: "years", years: 1 } as const, "1 year from Effective Date, but in the case of trade secrets"],
    [{ kind: "years", years: 5 } as const, "5 years from Effective Date, but in the case of trade secrets"],
    [{ kind: "perpetual" } as const, "In perpetuity."],
  ])("words the confidentiality term %j", (confidentialityTerm, expected) => {
    expect(textOf(build(completedNda({ confidentialityTerm })))).toContain(`Term of Confidentiality\n${expected}`);
  });

  it.each(["", "   ", "\n"])("says 'None.' when modifications are %j", (modifications) => {
    expect(textOf(build(completedNda({ modifications })))).toContain("MNDA Modifications\nNone.");
  });

  it("includes trimmed modifications, keeping line breaks", () => {
    const runs = runsOf(build(completedNda({ modifications: "  Clause 6 is deleted.\nClause 9: New York.  " })));
    expect(runs).toContainEqual({ text: "Clause 6 is deleted.\nClause 9: New York.", filled: true });
  });

  it("trims surrounding whitespace from values", () => {
    const runs = runsOf(build(completedNda({ governingLaw: "  Delaware  " })));
    expect(runs).toContainEqual({ text: "Delaware", filled: true });
  });

  it("shows a placeholder for blank or whitespace-only values", () => {
    const runs = runsOf(build(completedNda({ purpose: "  ", effectiveDate: "", governingLaw: "", jurisdiction: "\t" })));
    for (const field of ["Purpose", "Effective Date", "Governing Law", "Jurisdiction"]) {
      expect(runs).toContainEqual({ text: `[${field}]`, missing: true });
    }
  });

  it("treats user input as plain text, never as markup", () => {
    const hostile = '**bold** <script>alert(1)</script> [x](javascript:alert(1)) <span class="coverpage_link">X</span>';
    const runs = runsOf(build(completedNda({ purpose: hostile })));
    expect(runs).toContainEqual({ text: hostile, filled: true });
    expect(runs.some((r) => r.href?.startsWith("javascript:"))).toBe(false);
  });
});

describe("buildNda: signature table", () => {
  it("has one column per party and the rows from the template", () => {
    const table = signatures(build(completedNda()));
    expect(table.headers).toEqual(["Party 1", "Party 2"]);
    expect(table.rows.map((r) => r.label)).toEqual(["Signature", "Print Name", "Title", "Company", "Notice Address", "Date"]);
    expect(table.rows.find((r) => r.label === "Notice Address")?.hint).toBe("Email or postal address");
  });

  it("leaves signature and date blank for signing by hand", () => {
    const table = signatures(build(completedNda()));
    for (const label of ["Signature", "Date"]) {
      expect(table.rows.find((r) => r.label === label)?.values).toEqual([{ text: "" }, { text: "" }]);
    }
  });

  it("puts each party's details in its own column", () => {
    const table = signatures(build(completedNda()));
    const row = (label: string) => table.rows.find((r) => r.label === label)!.values.map((v) => v.text);
    expect(row("Print Name")).toEqual(["Ada Lovelace", "Alan Turing"]);
    expect(row("Title")).toEqual(["CEO", "CTO"]);
    expect(row("Company")).toEqual(["Acme Inc.", "Globex LLC"]);
    expect(row("Notice Address")).toEqual(["legal@acme.test", "1 Main St, Springfield"]);
  });

  it("shows placeholders for missing party details", () => {
    const table = signatures(build(defaultNdaData("2026-11-12")));
    const missing = table.rows.flatMap((r) => r.values).filter((v) => v.missing).map((v) => v.text);
    expect(missing).toEqual([
      "[Name]",
      "[Name]",
      "[Title]",
      "[Title]",
      "[Company]",
      "[Company]",
      "[Notice Address]",
      "[Notice Address]",
    ]);
  });
});
