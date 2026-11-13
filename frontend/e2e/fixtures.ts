import { test as base, expect, type Page } from "@playwright/test";
import { defaultNdaData, type NdaData } from "../src/lib/nda/model";

/**
 * `page` fixture that fails the test on any console error or uncaught
 * exception, so every e2e test doubles as a "no runtime errors" check.
 * `allowedConsoleErrors` lists expected messages, such as a failed request.
 */
export const test = base.extend<{ page: Page; allowedConsoleErrors: RegExp[] }>({
  allowedConsoleErrors: [[], { option: true }],
  page: async ({ page, allowedConsoleErrors }, provide) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && !allowedConsoleErrors.some((re) => re.test(msg.text()))) errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(String(err)));
    await provide(page);
    expect(errors, "console errors").toEqual([]);
  },
});

export { expect };

export const preview = (page: Page) => page.getByRole("article");
export const conversation = (page: Page) => page.getByRole("log", { name: "Conversation" });

/** Opens the NDA builder and waits for it to render on the client. */
export async function openBuilder(page: Page) {
  await page.goto("/nda/");
  await expect(page.getByRole("heading", { name: "Draft with AI" })).toBeVisible();
}

/** An NDA as the AI would return it, starting from the builder defaults. */
export function nda(overrides: Partial<NdaData> = {}): NdaData {
  return { ...defaultNdaData("2026-11-13"), ...overrides };
}

export const completedNda = nda({
  purpose: "Exploring a joint venture.",
  effectiveDate: "2027-03-04",
  governingLaw: "Delaware",
  jurisdiction: "New Castle, DE",
  parties: [
    { company: "Acme Inc.", name: "Ada Lovelace", title: "CEO", noticeAddress: "legal@acme.test" },
    { company: "Globex LLC", name: "Alan Turing", title: "CTO", noticeAddress: "1 Main St" },
  ],
});

/**
 * Answers `/api/chat` with the given NDAs, one per request, and records the
 * request bodies. The static e2e server has no backend.
 */
export async function mockChat(page: Page, ...ndas: NdaData[]) {
  const requests: { messages: { role: string; content: string }[]; nda: NdaData }[] = [];
  await page.route("**/api/chat", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { reply: `Reply ${requests.length}.`, nda: ndas[requests.length - 1] } });
  });
  return requests;
}

/** Sends a chat message and waits for the assistant's reply. */
export async function say(page: Page, text: string) {
  const bubbles = conversation(page).getByRole("listitem");
  const before = await bubbles.count();
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(bubbles).toHaveCount(before + 2);
}

/** Has the (mocked) AI fill in every field. */
export async function completeViaChat(page: Page) {
  await mockChat(page, completedNda);
  await say(page, "Acme and Globex, Delaware law, the usual terms.");
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
