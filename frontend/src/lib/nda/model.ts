/**
 * Renderer-agnostic document model for the Mutual NDA.
 *
 * The same `Block[]` drives both the on-screen HTML preview and the PDF, so
 * the two outputs can never drift apart. User input only ever lands in
 * `Run.text` (plain strings), never in markup.
 */

/** A span of text with simple formatting. */
export type Run = {
  text: string;
  bold?: boolean;
  href?: string;
  /** Value supplied by the user through the form. */
  filled?: boolean;
  /** Placeholder shown because the user has not supplied a value yet. */
  missing?: boolean;
};

export type SignatureRow = { label: string; hint?: string; values: [Run, Run] };

export type Block =
  | { kind: "heading"; level: 1 | 2 | 3; text: string }
  | { kind: "paragraph"; runs: Run[] }
  | { kind: "numbered"; number: string; runs: Run[] }
  | { kind: "signatures"; headers: [string, string]; rows: SignatureRow[] }
  | { kind: "pageBreak" };

export type Party = {
  name: string;
  title: string;
  company: string;
  noticeAddress: string;
};

export type NdaData = {
  purpose: string;
  /** ISO date, `YYYY-MM-DD`. */
  effectiveDate: string;
  mndaTerm: { kind: "years"; years: number } | { kind: "untilTerminated" };
  confidentialityTerm: { kind: "years"; years: number } | { kind: "perpetual" };
  governingLaw: string;
  jurisdiction: string;
  modifications: string;
  parties: [Party, Party];
};

const emptyParty = (): Party => ({ name: "", title: "", company: "", noticeAddress: "" });

/** Defaults mirror the pre-selected options in the Common Paper cover page. */
export function defaultNdaData(effectiveDate: string): NdaData {
  return {
    purpose: "Evaluating whether to enter into a business relationship with the other party.",
    effectiveDate,
    mndaTerm: { kind: "years", years: 1 },
    confidentialityTerm: { kind: "years", years: 1 },
    governingLaw: "",
    jurisdiction: "",
    modifications: "",
    parties: [emptyParty(), emptyParty()],
  };
}
