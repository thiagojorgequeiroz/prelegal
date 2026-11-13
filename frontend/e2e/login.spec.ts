import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test.describe("fake login", () => {
  test("shows the sign-in screen at the root", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Sign in · Prelegal");
    await expect(page.getByRole("heading", { name: "Prelegal" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("brings the user into the NDA builder with any credentials", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("ada@example.com");
    await page.getByLabel("Password").fill("anything");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/nda\/$/);
    await expect(page.getByRole("heading", { name: "Agreement details" })).toBeVisible();
  });

  test("stays on the sign-in screen when fields are empty", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("signs out back to the sign-in screen", async ({ page }) => {
    await page.goto("/nda/");
    await page.getByRole("link", { name: "Sign out" }).click();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("uses the purple secondary color for the submit button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Sign in" })).toHaveCSS("background-color", "rgb(117, 57, 145)");
  });

  test("has no detectable WCAG A/AA violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([]);
  });
});
