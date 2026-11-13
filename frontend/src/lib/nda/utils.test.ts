import { describe, expect, it } from "vitest";
import { completedNda } from "@/test/fixtures";
import type { Party } from "./model";
import { pdfFileName, toIsoDate } from "./utils";

describe("toIsoDate", () => {
  it("formats the local calendar date with zero padding", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(toIsoDate(new Date(2026, 10, 12, 23, 59))).toBe("2026-11-12");
  });
});

describe("pdfFileName", () => {
  const withCompanies = (a: string, b: string) => {
    const data = completedNda();
    const party = (p: Party, company: string) => ({ ...p, company });
    return { ...data, parties: [party(data.parties[0], a), party(data.parties[1], b)] as [Party, Party] };
  };

  it.each([
    ["", "", "Mutual-NDA.pdf"],
    ["Acme", "", "Mutual-NDA-Acme.pdf"],
    ["", "Globex", "Mutual-NDA-Globex.pdf"],
    ["Acme Inc.", "Globex LLC", "Mutual-NDA-Acme-Inc-Globex-LLC.pdf"],
    ["  Acme  ", "   ", "Mutual-NDA-Acme.pdf"],
    ["A/B\\C:D*E?F", "<G>|H", "Mutual-NDA-A-B-C-D-E-F-G-H.pdf"],
    ["Łódź Labs", "ООО «Ромашка»", "Mutual-NDA-Łódź-Labs-ООО-Ромашка.pdf"],
    ["株式会社", "", "Mutual-NDA-株式会社.pdf"],
  ])("companies %j and %j → %s", (a, b, expected) => {
    expect(pdfFileName(withCompanies(a, b))).toBe(expected);
  });

  it("never contains characters that are unsafe in file names", () => {
    const name = pdfFileName(withCompanies('../../etc/"passwd"', "a\u0000b"));
    expect(name).not.toMatch(/[/\\:*?"<>|\u0000]/);
    expect(name).not.toContain("..");
  });
});
