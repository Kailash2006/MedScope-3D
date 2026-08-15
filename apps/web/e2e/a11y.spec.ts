import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Triage page accessibility", () => {
  test("has no serious/critical axe violations (WCAG 2.1 A/AA)", async ({ page }) => {
    await page.goto("/triage");
    await page.getByRole("heading", { name: /Symptom Triage/i }).waitFor();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const blocking = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    // Log any for debugging, then assert none block.
    if (blocking.length) console.log(JSON.stringify(blocking.map((v) => v.id), null, 2));
    expect(blocking).toEqual([]);
  });

  test("region selection is keyboard-operable", async ({ page }) => {
    await page.goto("/triage");
    const head = page.getByRole("button", { name: "Head" });
    await head.focus();
    await expect(head).toBeFocused();
    await expect(head).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Enter");
    await expect(head).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Space");
    await expect(head).toHaveAttribute("aria-pressed", "false");
  });

  test("full keyboard tab flow reaches the forms", async ({ page }) => {
    await page.goto("/triage");
    // Tab through several controls; assert focus lands on interactive elements.
    for (let i = 0; i < 5; i++) await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => document.activeElement?.tagName ?? "");
    expect(["BUTTON", "INPUT", "SELECT", "A"]).toContain(tag);
  });
});
