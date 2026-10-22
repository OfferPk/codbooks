import { test, expect } from "@playwright/test";

test.describe("Pricing Page E2E", () => {
  test("renders cleanly on mobile viewport (390px) without horizontal scroll", async ({
    page,
  }) => {
    await page.goto("/pricing");
    await expect(page.locator("h1")).toContainText(/Stop losing hard-earned cash/i);

    // Verify 0 horizontal overflow
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("toggles between monthly and annual billing cycles updating tier prices", async ({
    page,
  }) => {
    await page.goto("/pricing");

    // Monthly view default
    await expect(page.locator("text=PKR 2,500")).toBeVisible();

    // Click Annually
    await page.click("button:has-text('Annually')");
    await expect(page.locator("text=PKR 2,000")).toBeVisible();
    await expect(page.locator("text=Billed PKR 24,000 annually")).toBeVisible();

    // Click Monthly
    await page.click("button:has-text('Monthly')");
    await expect(page.locator("text=PKR 2,500")).toBeVisible();
  });

  test("expands and collapses FAQ items", async ({ page }) => {
    await page.goto("/pricing");

    const firstFaqQuestion = page.locator("text=How does CodBooks find money Pakistani couriers owe me?");
    await expect(firstFaqQuestion).toBeVisible();

    // Click question to expand answer
    await firstFaqQuestion.click();
    await expect(
      page.locator("text=CodBooks imports your booked Shopify/WooCommerce orders")
    ).toBeVisible();

    // Click again to collapse
    await firstFaqQuestion.click();
    await expect(
      page.locator("text=CodBooks imports your booked Shopify/WooCommerce orders")
    ).not.toBeVisible();
  });

  test("displays accepted Pakistani payment methods", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.locator("text=JazzCash")).toBeVisible();
    await expect(page.locator("text=Easypaisa")).toBeVisible();
    await expect(page.locator("text=Raast / 1Link IBFT")).toBeVisible();
  });
});

test.describe("Demo Page E2E", () => {
  test("renders demo page with metrics and table at 390px", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.locator("h1")).toContainText(/COD Settlement Audit & Recovery Demo/i);

    // Verify 0 horizontal overflow
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test("filters table items by courier tab", async ({ page }) => {
    await page.goto("/demo");

    // Click TCS filter
    await page.click("button:has-text('tcs')");
    await expect(page.locator("text=ORD-9412")).toBeVisible();
    await expect(page.locator("text=ORD-9388")).not.toBeVisible(); // PostEx item hidden

    // Click all filter
    await page.click("button:has-text('all')");
    await expect(page.locator("text=ORD-9388")).toBeVisible();
  });

  test("opens dispute draft modal for an item", async ({ page }) => {
    await page.goto("/demo");

    // Click first Draft Claim button
    await page.locator("button:has-text('Draft Claim')").first().click();
    await expect(page.locator("text=Dispute Draft Preview")).toBeVisible();
    await expect(page.locator("textarea")).toBeVisible();

    // Close modal
    await page.locator("button:has-text('✕')").click();
    await expect(page.locator("text=Dispute Draft Preview")).not.toBeVisible();
  });
});
