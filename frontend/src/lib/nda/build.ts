import type { Block, NdaData, Run } from "./model";

const STANDARD_TERMS_URL = "https://commonpaper.com/standards/mutual-nda/1.0";
const LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/";

/**
 * Formats an ISO `YYYY-MM-DD` date as e.g. "November 12, 2026". Returns ""
 * for incomplete input, such as the year while it is still being typed.
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!(y >= 1000) || !m || !d) return "";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function pluralizeYears(years: number): string {
  return `${years} ${years === 1 ? "year" : "years"}`;
}

/** A user-supplied value, or a visible placeholder when it is blank. */
function field(value: string, placeholder: string): Run {
  const text = value.trim();
  return text ? { text, filled: true } : { text: `[${placeholder}]`, missing: true };
}

const t = (text: string, bold = false): Run => (bold ? { text, bold } : { text });
const p = (...runs: Run[]): Block => ({ kind: "paragraph", runs });
const h3 = (text: string): Block => ({ kind: "heading", level: 3, text });

/**
 * Builds the full MNDA: the Cover Page filled in from the form data, followed
 * by the verbatim Standard Terms.
 */
export function buildNda(data: NdaData, terms: Block[]): Block[] {
  return [...coverPage(data), { kind: "pageBreak" }, ...terms];
}

function coverPage(data: NdaData): Block[] {
  const effectiveDate = field(formatDate(data.effectiveDate), "Effective Date");

  const mndaTerm =
    data.mndaTerm.kind === "years"
      ? p(t("Expires "), { text: pluralizeYears(data.mndaTerm.years), filled: true }, t(" from Effective Date."))
      : p(t("Continues until terminated in accordance with the terms of the MNDA."));

  const confidentialityTerm =
    data.confidentialityTerm.kind === "years"
      ? p(
          { text: pluralizeYears(data.confidentialityTerm.years), filled: true },
          t(
            " from Effective Date, but in the case of trade secrets until Confidential Information is no longer considered a trade secret under applicable laws.",
          ),
        )
      : p(t("In perpetuity."));

  const [one, two] = data.parties;
  const blank: Run = { text: "" };

  return [
    { kind: "heading", level: 1, text: "Mutual Non-Disclosure Agreement" },
    { kind: "heading", level: 2, text: "Using this Mutual Non-Disclosure Agreement" },
    p(
      t("This Mutual Non-Disclosure Agreement (the “MNDA”) consists of: (1) this Cover Page (“"),
      t("Cover Page", true),
      t("”) and (2) the Common Paper Mutual NDA Standard Terms Version 1.0 (“"),
      t("Standard Terms", true),
      t("”) identical to those posted at "),
      { text: "commonpaper.com/standards/mutual-nda/1.0", href: STANDARD_TERMS_URL },
      t(
        ". Any modifications of the Standard Terms should be made on the Cover Page, which will control over conflicts with the Standard Terms.",
      ),
    ),
    h3("Purpose"),
    p(field(data.purpose, "Purpose")),
    h3("Effective Date"),
    p(effectiveDate),
    h3("MNDA Term"),
    mndaTerm,
    h3("Term of Confidentiality"),
    confidentialityTerm,
    h3("Governing Law & Jurisdiction"),
    p(t("Governing Law: "), field(data.governingLaw, "Governing Law")),
    p(t("Jurisdiction: courts located in "), field(data.jurisdiction, "Jurisdiction")),
    h3("MNDA Modifications"),
    p(data.modifications.trim() ? { text: data.modifications.trim(), filled: true } : t("None.")),
    p(t("By signing this Cover Page, each party agrees to enter into this MNDA as of the Effective Date.")),
    {
      kind: "signatures",
      headers: ["Party 1", "Party 2"],
      rows: [
        { label: "Signature", values: [blank, blank] },
        { label: "Print Name", values: [field(one.name, "Name"), field(two.name, "Name")] },
        { label: "Title", values: [field(one.title, "Title"), field(two.title, "Title")] },
        { label: "Company", values: [field(one.company, "Company"), field(two.company, "Company")] },
        {
          label: "Notice Address",
          hint: "Email or postal address",
          values: [field(one.noticeAddress, "Notice Address"), field(two.noticeAddress, "Notice Address")],
        },
        { label: "Date", values: [blank, blank] },
      ],
    },
    p(
      t("Common Paper Mutual Non-Disclosure Agreement (Version 1.0) free to use under "),
      { text: "CC BY 4.0", href: LICENSE_URL },
      t("."),
    ),
  ];
}
