import AxeBuilder from "@axe-core/playwright";
import { completeViaChat, conversation, expect, nda, openBuilder, preview, test } from "./fixtures";

test.describe("accessibility", () => {
  test("has no detectable WCAG A/AA violations", async ({ page }) => {
    await openBuilder(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });

  test("has no violations after a chat turn", async ({ page }) => {
    await openBuilder(page);
    await completeViaChat(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test("supports chatting with the keyboard", async ({ page }) => {
    await page.route("**/api/chat", (route) =>
      route.fulfill({ json: { reply: "Delaware it is.", nda: nda({ governingLaw: "Delaware" }) } }),
    );
    await openBuilder(page);
    await page.getByLabel("Message").focus();
    await page.keyboard.type("Delaware law");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Send" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(conversation(page)).toContainText("Delaware it is.");
    await expect(preview(page)).toContainText("Governing Law: Delaware");

    // Enter in the message box also sends.
    await page.getByLabel("Message").focus();
    await page.keyboard.type("Thanks");
    await page.keyboard.press("Enter");
    await expect(conversation(page).getByText("Thanks")).toBeVisible();
  });
});

test.describe("layout", () => {
  test("never scrolls horizontally", async ({ page }) => {
    await openBuilder(page);
    await completeViaChat(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("keeps the header and download button in view on desktop", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop-only split view");
    await openBuilder(page);

    // The page itself fits the viewport; the chat and preview scroll on their own.
    const { docHeight, viewport } = await page.evaluate(() => ({
      docHeight: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
    }));
    expect(docHeight).toBeLessThanOrEqual(viewport);

    await page.getByLabel("Message").scrollIntoViewIfNeeded();
    await expect(page.getByText("Prelegal", { exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeInViewport();
  });

  test("shows the chat and preview side by side on desktop", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop-only split view");
    await openBuilder(page);
    const form = await page.locator("aside").boundingBox();
    const doc = await preview(page).boundingBox();
    expect(form && doc && form.x + form.width <= doc.x).toBe(true);
  });

  test("stacks the chat above the preview on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only layout");
    await openBuilder(page);
    const form = await page.locator("aside").boundingBox();
    const doc = await preview(page).boundingBox();
    expect(form && doc && form.y + form.height <= doc.y).toBe(true);
    await expect(page.getByText("Based on Common Paper Mutual NDA v1.0")).toBeHidden();
  });
});
