import { downloadPdf, expect, fillCompletedForm, fillParty, openBuilder, party, preview, test } from "./fixtures";

test.describe("page", () => {
  test("has a descriptive title and header", async ({ page }) => {
    await openBuilder(page);
    await expect(page).toHaveTitle("Mutual NDA Creator · Prelegal");
    await expect(page.getByText("Prelegal", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  });

  test("defaults the effective date to the visitor's today", async ({ page }) => {
    await openBuilder(page);
    const today = await page.evaluate(() => {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    });
    await expect(page.getByLabel("Effective date")).toHaveValue(today);
  });

  test("uses the visitor's timezone for the default date", async ({ browser }) => {
    // Just after midnight in Tokyo is still the previous day in UTC.
    const context = await browser.newContext({ timezoneId: "Asia/Tokyo" });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-12T15:30:00Z")); // 00:30 on Nov 13 in Tokyo
    await openBuilder(page);
    await expect(page.getByLabel("Effective date")).toHaveValue("2026-11-13");
    await expect(preview(page)).toContainText("November 13, 2026");
    await context.close();
  });
});

test.describe("live preview", () => {
  test("starts with placeholders for every missing value", async ({ page }) => {
    await openBuilder(page);
    for (const placeholder of ["[Governing Law]", "[Jurisdiction]"]) {
      await expect(preview(page).getByText(placeholder, { exact: true })).toBeVisible();
    }
    await expect(preview(page).getByText("[Company]", { exact: true })).toHaveCount(2);
  });

  test("shows every form value in the agreement", async ({ page }) => {
    await openBuilder(page);
    await fillCompletedForm(page);

    const doc = preview(page);
    await expect(doc).toContainText("Exploring a joint venture.");
    await expect(doc).toContainText("March 4, 2027");
    await expect(doc).toContainText("Governing Law: Delaware");
    await expect(doc).toContainText("Jurisdiction: courts located in New Castle, DE");
    for (const value of ["Acme Inc.", "Ada Lovelace", "CEO", "legal@acme.test", "Globex LLC", "Alan Turing", "CTO", "1 Main St"]) {
      await expect(doc.getByRole("table")).toContainText(value);
    }
    await expect(doc.getByText(/^\[.*\]$/)).toHaveCount(0);
  });

  test("puts each party in its own column", async ({ page }) => {
    await openBuilder(page);
    await fillCompletedForm(page);
    const nameRow = preview(page).getByRole("row", { name: /Print Name/ });
    await expect(nameRow.getByRole("cell")).toHaveText(["Ada Lovelace", "Alan Turing"]);
  });

  test("words the MNDA and confidentiality terms from the chosen options", async ({ page }) => {
    await openBuilder(page);
    const doc = preview(page);

    await page.getByRole("combobox", { name: "MNDA term length" }).selectOption("3");
    await expect(doc).toContainText("Expires 3 years from Effective Date.");
    await page.getByRole("radio", { name: "Continues until terminated" }).check();
    await expect(doc).toContainText("Continues until terminated in accordance with the terms of the MNDA.");

    await page.getByRole("combobox", { name: "Confidentiality term length" }).selectOption("5");
    await expect(doc).toContainText("5 years from Effective Date, but in the case of trade secrets");
    await page.getByRole("radio", { name: "In perpetuity" }).check();
    await expect(doc).toContainText("In perpetuity.");
  });

  test("lists modifications, or 'None.' when there are none", async ({ page }) => {
    await openBuilder(page);
    const section = preview(page).getByRole("heading", { name: "MNDA Modifications" }).locator("xpath=following-sibling::p[1]");
    await expect(section).toHaveText("None.");
    await page.getByLabel("Modifications").fill("Clause 6 does not apply.");
    await expect(section).toHaveText("Clause 6 does not apply.");
    await page.getByLabel("Modifications").fill("");
    await expect(section).toHaveText("None.");
  });

  test("keeps the Standard Terms verbatim", async ({ page }) => {
    await openBuilder(page);
    await fillCompletedForm(page);
    const doc = preview(page);
    await expect(doc.getByRole("heading", { name: "Standard Terms" })).toBeVisible();
    await expect(doc).toContainText(
      "governed by, and construed in accordance with, the laws of the State of Governing Law, without regard",
    );
    await expect(doc).toContainText("This MNDA commences on the Effective Date and expires at the end of the MNDA Term.");
    await expect(doc).not.toContainText("coverpage_link");
  });

  test("renders user input as text, not HTML", async ({ page }) => {
    await openBuilder(page);
    const payload = '<img src=x onerror="window.__xss=1"><b>bold</b>';
    await page.getByLabel("Purpose").fill(payload);
    await expect(preview(page).getByText(payload)).toBeVisible();
    await expect(preview(page).locator("img")).toHaveCount(0);
    expect(await page.evaluate(() => (window as { __xss?: number }).__xss)).toBeUndefined();
  });

  test("opens the Common Paper links in a new tab", async ({ page }) => {
    await openBuilder(page);
    const link = preview(page).getByRole("link", { name: "commonpaper.com/standards/mutual-nda/1.0" });
    await expect(link).toHaveAttribute("href", "https://commonpaper.com/standards/mutual-nda/1.0");
    await expect(link).toHaveAttribute("target", "_blank");
  });
});

test.describe("PDF download", () => {
  test("downloads a valid multi-page PDF named after the parties", async ({ page }) => {
    await openBuilder(page);
    await fillCompletedForm(page);
    const { fileName, bytes } = await downloadPdf(page);

    expect(fileName).toBe("Mutual-NDA-Acme-Inc-Globex-LLC.pdf");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    const pages = bytes.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(3);
  });

  test("embeds the Unicode font so non-Latin names survive", async ({ page }) => {
    await openBuilder(page);
    await fillParty(page, 1, { company: "Łódź Labs", name: "Łukasz Ołdakowski", title: "Prezes", noticeAddress: "ul. Długa 1" });
    await fillParty(page, 2, { company: "ООО «Ромашка»", name: "Ольга", title: "Директор", noticeAddress: "Москва" });
    const { fileName, bytes } = await downloadPdf(page);

    expect(fileName).toBe("Mutual-NDA-Łódź-Labs-ООО-Ромашка.pdf");
    expect(bytes.toString("latin1")).toMatch(/\/BaseFont \/[A-Z]{6}\+NotoSerif/);
    expect(bytes.toString("latin1")).not.toContain("/BaseFont /Times-Roman");
  });

  test("works for an untouched form", async ({ page }) => {
    await openBuilder(page);
    const { fileName, bytes } = await downloadPdf(page);
    expect(fileName).toBe("Mutual-NDA.pdf");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("loads the PDF engine and fonts only when downloading", async ({ page }) => {
    const fontRequests: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/fonts/")) fontRequests.push(req.url());
    });
    await openBuilder(page);
    expect(fontRequests).toEqual([]);

    await downloadPdf(page);
    expect(fontRequests.some((url) => url.endsWith("/fonts/NotoSerif-Regular.ttf"))).toBe(true);
    expect(fontRequests.some((url) => url.endsWith("/fonts/NotoSerif-Bold.ttf"))).toBe(true);
  });

  test("can be triggered from the keyboard", async ({ page }) => {
    await openBuilder(page);
    await page.getByRole("button", { name: "Download PDF" }).focus();
    const [download] = await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);
    expect(download.suggestedFilename()).toBe("Mutual-NDA.pdf");
  });

  test("can be downloaded again after editing", async ({ page }) => {
    await openBuilder(page);
    await party(page, 1).getByLabel("Company").fill("First");
    expect((await downloadPdf(page)).fileName).toBe("Mutual-NDA-First.pdf");
    await party(page, 1).getByLabel("Company").fill("Second");
    expect((await downloadPdf(page)).fileName).toBe("Mutual-NDA-Second.pdf");
  });
});
