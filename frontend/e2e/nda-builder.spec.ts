import {
  completeViaChat,
  completedNda,
  conversation,
  downloadPdf,
  expect,
  mockChat,
  nda,
  openBuilder,
  preview,
  say,
  test,
} from "./fixtures";

const localToday = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

test.describe("page", () => {
  test("has a descriptive title and header", async ({ page }) => {
    await openBuilder(page);
    await expect(page).toHaveTitle("Mutual NDA Creator · Prelegal");
    await expect(page.getByText("Prelegal", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeEnabled();
  });

  test("sends the visitor's today as the default effective date", async ({ page }) => {
    const requests = await mockChat(page, nda());
    await openBuilder(page);
    await say(page, "Hello");
    expect(requests[0].nda.effectiveDate).toBe(await page.evaluate(localToday));
  });

  test("uses the visitor's timezone for the default date", async ({ browser }) => {
    // Just after midnight in Tokyo is still the previous day in UTC.
    const context = await browser.newContext({ timezoneId: "Asia/Tokyo" });
    const page = await context.newPage();
    await page.clock.setFixedTime(new Date("2026-11-12T15:30:00Z")); // 00:30 on Nov 13 in Tokyo
    await openBuilder(page);
    await expect(preview(page)).toContainText("November 13, 2026");
    await context.close();
  });
});

test.describe("AI chat", () => {
  test("greets the user without calling the API", async ({ page }) => {
    const requests = await mockChat(page);
    await openBuilder(page);
    await expect(conversation(page)).toContainText("I'll help you draft a Mutual NDA");
    expect(requests).toEqual([]);
  });

  test("sends the whole conversation and the current NDA each turn", async ({ page }) => {
    const first = nda({ governingLaw: "Delaware" });
    const requests = await mockChat(page, first, first);
    await openBuilder(page);

    await say(page, "Delaware law");
    await expect(conversation(page)).toContainText("Reply 1.");
    await say(page, "Thanks");

    expect(requests[0].messages).toEqual([{ role: "user", content: "Delaware law" }]);
    expect(requests[1].messages).toEqual([
      { role: "user", content: "Delaware law" },
      { role: "assistant", content: "Reply 1." },
      { role: "user", content: "Thanks" },
    ]);
    expect(requests[1].nda).toEqual(first);
  });

  test("shows that the assistant is thinking", async ({ page }) => {
    let release!: () => void;
    const released = new Promise<void>((r) => (release = r));
    await page.route("**/api/chat", async (route) => {
      await released;
      await route.fulfill({ json: { reply: "Done.", nda: nda() } });
    });
    await openBuilder(page);

    await page.getByLabel("Message").fill("Hello");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("status")).toHaveText("Thinking…");
    release();
    await expect(conversation(page)).toContainText("Done.");
    await expect(page.getByRole("status")).toBeHidden();
  });

  test.describe("when the server fails", () => {
    test.use({ allowedConsoleErrors: [/Failed to load resource/] });

    test("shows the error and keeps the message", async ({ page }) => {
      await page.route("**/api/chat", (route) =>
        route.fulfill({ status: 503, json: { detail: "The AI assistant is not configured." } }),
      );
      await openBuilder(page);
      await page.getByLabel("Message").fill("Hello");
      await page.getByRole("button", { name: "Send" }).click();

      // Next.js renders its own empty route announcer with role="alert".
      await expect(page.locator("p[role=alert]")).toHaveText("The AI assistant is not configured.");
      await expect(page.getByLabel("Message")).toHaveValue("Hello");
    });
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

  test("shows every value from the chat in the agreement", async ({ page }) => {
    await openBuilder(page);
    await completeViaChat(page);

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
    await completeViaChat(page);
    const nameRow = preview(page).getByRole("row", { name: /Print Name/ });
    await expect(nameRow.getByRole("cell")).toHaveText(["Ada Lovelace", "Alan Turing"]);
  });

  test("words the MNDA and confidentiality terms from the chosen options", async ({ page }) => {
    await mockChat(
      page,
      nda({ mndaTerm: { kind: "years", years: 3 }, confidentialityTerm: { kind: "years", years: 5 } }),
      nda({ mndaTerm: { kind: "untilTerminated" }, confidentialityTerm: { kind: "perpetual" } }),
    );
    await openBuilder(page);
    const doc = preview(page);

    await say(page, "Three years, confidential for five");
    await expect(doc).toContainText("Expires 3 years from Effective Date.");
    await expect(doc).toContainText("5 years from Effective Date, but in the case of trade secrets");

    await say(page, "Actually until terminated, confidential forever");
    await expect(doc).toContainText("Continues until terminated in accordance with the terms of the MNDA.");
    await expect(doc).toContainText("In perpetuity.");
  });

  test("lists modifications, or 'None.' when there are none", async ({ page }) => {
    await mockChat(page, nda({ modifications: "Clause 6 does not apply." }), nda());
    await openBuilder(page);
    const section = preview(page).getByRole("heading", { name: "MNDA Modifications" }).locator("xpath=following-sibling::p[1]");
    await expect(section).toHaveText("None.");
    await say(page, "Clause 6 does not apply");
    await expect(section).toHaveText("Clause 6 does not apply.");
    await say(page, "Remove that");
    await expect(section).toHaveText("None.");
  });

  test("keeps the Standard Terms verbatim", async ({ page }) => {
    await openBuilder(page);
    await completeViaChat(page);
    const doc = preview(page);
    await expect(doc.getByRole("heading", { name: "Standard Terms" })).toBeVisible();
    await expect(doc).toContainText(
      "governed by, and construed in accordance with, the laws of the State of Governing Law, without regard",
    );
    await expect(doc).toContainText("This MNDA commences on the Effective Date and expires at the end of the MNDA Term.");
    await expect(doc).not.toContainText("coverpage_link");
  });

  test("renders chat and AI text as text, not HTML", async ({ page }) => {
    const payload = '<img src=x onerror="window.__xss=1"><b>bold</b>';
    await mockChat(page, nda({ purpose: payload }));
    await openBuilder(page);
    await say(page, payload);
    await expect(preview(page).getByText(payload)).toBeVisible();
    await expect(conversation(page).getByText(payload)).toBeVisible();
    await expect(page.locator("img")).toHaveCount(0);
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
    await completeViaChat(page);
    const { fileName, bytes } = await downloadPdf(page);

    expect(fileName).toBe("Mutual-NDA-Acme-Inc-Globex-LLC.pdf");
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect(bytes.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    const pages = bytes.toString("latin1").match(/\/Type \/Page\b/g) ?? [];
    expect(pages.length).toBeGreaterThanOrEqual(3);
  });

  test("embeds the Unicode font so non-Latin names survive", async ({ page }) => {
    await mockChat(
      page,
      nda({
        parties: [
          { company: "Łódź Labs", name: "Łukasz Ołdakowski", title: "Prezes", noticeAddress: "ul. Długa 1" },
          { company: "ООО «Ромашка»", name: "Ольга", title: "Директор", noticeAddress: "Москва" },
        ],
      }),
    );
    await openBuilder(page);
    await say(page, "Łódź Labs and ООО «Ромашка»");
    const { fileName, bytes } = await downloadPdf(page);

    expect(fileName).toBe("Mutual-NDA-Łódź-Labs-ООО-Ромашка.pdf");
    expect(bytes.toString("latin1")).toMatch(/\/BaseFont \/[A-Z]{6}\+NotoSerif/);
    expect(bytes.toString("latin1")).not.toContain("/BaseFont /Times-Roman");
  });

  test("works before any chat", async ({ page }) => {
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

  test("can be downloaded again after the chat changes the NDA", async ({ page }) => {
    const withCompany = (company: string) => nda({ parties: [{ ...completedNda.parties[0], company }, nda().parties[1]] });
    await mockChat(page, withCompany("First"), withCompany("Second"));
    await openBuilder(page);
    await say(page, "First");
    expect((await downloadPdf(page)).fileName).toBe("Mutual-NDA-First.pdf");
    await say(page, "Rename to Second");
    expect((await downloadPdf(page)).fileName).toBe("Mutual-NDA-Second.pdf");
  });
});
