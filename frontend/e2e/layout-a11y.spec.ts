import AxeBuilder from "@axe-core/playwright";
import { expect, fillCompletedForm, openBuilder, preview, test } from "./fixtures";

test.describe("accessibility", () => {
  test("has no detectable WCAG A/AA violations", async ({ page }) => {
    await openBuilder(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });

  test("has no violations with a completed form", async ({ page }) => {
    await openBuilder(page);
    await fillCompletedForm(page);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });

  test("supports keyboard navigation", async ({ page }) => {
    await openBuilder(page);
    // Tab order follows the visual order of the text fields.
    await page.getByLabel("Governing law").focus();
    await page.keyboard.type("Delaware");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Jurisdiction")).toBeFocused();
    await page.keyboard.type("New Castle, DE");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Modifications")).toBeFocused();
    await expect(preview(page)).toContainText("Governing Law: Delaware");

    // Radio groups are operated with the arrow keys.
    await page.getByRole("radio", { name: "Expires" }).focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("radio", { name: "Continues until terminated" })).toBeChecked();
    await expect(preview(page)).toContainText("Continues until terminated in accordance with the terms of the MNDA.");
  });
});

test.describe("layout", () => {
  test("never scrolls horizontally", async ({ page }) => {
    await openBuilder(page);
    await fillCompletedForm(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("keeps the header and download button in view on desktop", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop-only split view");
    await openBuilder(page);

    // The page itself fits the viewport; the form and preview scroll on their own.
    const { docHeight, viewport } = await page.evaluate(() => ({
      docHeight: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
    }));
    expect(docHeight).toBeLessThanOrEqual(viewport);

    await page.getByRole("group", { name: "Party 2" }).getByLabel("Notice address").scrollIntoViewIfNeeded();
    await expect(page.getByText("Prelegal", { exact: true })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeInViewport();
  });

  test("shows the form and preview side by side on desktop", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop-only split view");
    await openBuilder(page);
    const form = await page.locator("aside").boundingBox();
    const doc = await preview(page).boundingBox();
    expect(form && doc && form.x + form.width <= doc.x).toBe(true);
  });

  test("stacks the form above the preview on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only layout");
    await openBuilder(page);
    const form = await page.locator("aside").boundingBox();
    const doc = await preview(page).boundingBox();
    expect(form && doc && form.y + form.height <= doc.y).toBe(true);
    await expect(page.getByText("Based on Common Paper Mutual NDA v1.0")).toBeHidden();
  });
});
