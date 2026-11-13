import type { NdaData } from "./model";

/** A date as `YYYY-MM-DD` in the local calendar (what `<input type="date">` uses). */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Download name built from the party companies, e.g. `Mutual-NDA-Acme-Inc-Globex.pdf`. */
export function pdfFileName(data: NdaData): string {
  const names = data.parties
    .map((p) => p.company.trim())
    .filter(Boolean)
    .join("-");
  // Keep letters and digits from any script; collapse everything else to "-".
  const slug = names.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return `Mutual-NDA${slug ? `-${slug}` : ""}.pdf`;
}
