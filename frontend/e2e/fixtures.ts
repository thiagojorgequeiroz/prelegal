import { test as base, expect, type Page } from "@playwright/test";

/**
 * `page` fixture that fails the test on any console error or uncaught
 * exception, so every e2e test doubles as a "no runtime errors" check.
 */
export const test = base.extend<{ page: Page }>({
  page: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));
    await provide(page);
    expect(errors, "console errors").toEqual([]);
  },
});

export { expect };

export const preview = (page: Page) => page.getByRole("article");
export const party = (page: Page, n: 1 | 2) => page.getByRole("group", { name: `Party ${n}` });

/** Opens the NDA builder and waits for it to render on the client. */
export async function openBuilder(page: Page) {
  await page.goto("/nda/");
  await expect(page.getByRole("heading", { name: "Agreement details" })).toBeVisible();
}

export type PartyDetails = { company: string; name: string; title: string; noticeAddress: string };

export async function fillParty(page: Page, n: 1 | 2, details: PartyDetails) {
  const group = party(page, n);
  await group.getByLabel("Company").fill(details.company);
  await group.getByLabel("Signer name").fill(details.name);
  await group.getByLabel("Title").fill(details.title);
  await group.getByLabel("Notice address").fill(details.noticeAddress);
}

export async function fillCompletedForm(page: Page) {
  await page.getByLabel("Purpose").fill("Exploring a joint venture.");
  await page.getByLabel("Effective date").fill("2027-03-04");
  await page.getByLabel("Governing law").fill("Delaware");
  await page.getByLabel("Jurisdiction").fill("New Castle, DE");
  await fillParty(page, 1, { company: "Acme Inc.", name: "Ada Lovelace", title: "CEO", noticeAddress: "legal@acme.test" });
  await fillParty(page, 2, { company: "Globex LLC", name: "Alan Turing", title: "CTO", noticeAddress: "1 Main St" });
}

/** Clicks Download PDF and returns the saved file name and bytes. */
export async function downloadPdf(page: Page) {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).click(),
  ]);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return { fileName: download.suggestedFilename(), bytes: Buffer.concat(chunks) };
}
