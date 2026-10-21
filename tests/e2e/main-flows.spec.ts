import { test, expect } from "@playwright/test";

test.describe("CodBooks Responsive, Dark Mode & Urdu E2E", () => {
  test("login page renders cleanly without horizontal scroll", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.locator("h1")).toContainText(/CodBooks|Log in/i);

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("register page renders cleanly", async ({ page }) => {
    await page.goto("/register");
    await expect(page.locator("h1")).toContainText(/Register|Create/i);
  });

  test("theme toggle persists dark mode", async ({ page }) => {
    await page.goto("/login");

    // Test that client script applies dark mode when set in localStorage
    await page.evaluate(() => {
      localStorage.setItem("codbooks_theme", "dark");
    });
    await page.reload();

    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isDark).toBe(true);

    // Switch back to light
    await page.evaluate(() => {
      localStorage.setItem("codbooks_theme", "light");
    });
    await page.reload();

    const isLight = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isLight).toBe(false);
  });

  test("urdu toggle persists RTL direction and locale", async ({ page }) => {
    await page.goto("/login");

    // Test that client script applies RTL and ur lang when set in localStorage
    await page.evaluate(() => {
      localStorage.setItem("codbooks_lang", "ur");
    });
    await page.reload();

    const dir = await page.evaluate(() => document.documentElement.dir);
    const lang = await page.evaluate(() => document.documentElement.lang);
    expect(dir).toBe("rtl");
    expect(lang).toBe("ur");

    // Switch back to English
    await page.evaluate(() => {
      localStorage.setItem("codbooks_lang", "en");
    });
    await page.reload();

    const dirEn = await page.evaluate(() => document.documentElement.dir);
    expect(dirEn).toBe("ltr");
  });
});
