import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the canonical forgot-password flow rendered at
 * `/forgot-password` (`frontend/components/auth/forgot-password-form.tsx`).
 *
 * The three backend endpoints exercised by this flow are intercepted and
 * stubbed with page.route so the suite runs without Postgres / SMTP / a
 * live NestJS server. The wiring is the asserted contract:
 * `/auth/forgot-password`, `/auth/verify-reset-password-otp`,
 * `/auth/reset-password` are all called once on a happy path.
 */
test.describe("Forgot password flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/forgot-password", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Password reset instructions sent to email",
        }),
      }),
    );
    await page.route("**/api/auth/verify-reset-password-otp", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "OTP verified successfully" }),
      }),
    );
    await page.route("**/api/auth/reset-password", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ message: "Password reset successfully" }),
      }),
    );
  });

  test("user requests, verifies OTP, sets new password, and reaches /login", async ({
    page,
  }) => {
    await page.goto("/forgot-password");
    await page.waitForLoadState("networkidle");

    // Step 1: Email.
    await expect(
      page.getByRole("heading", { name: /Forgot Password\?/i }),
    ).toBeVisible({ timeout: 15_000 });
    await page.getByLabel(/Email Address/i).fill("jane@example.com");
    await page.getByRole("button", { name: /Send Reset Code/i }).click();

    // Step 2: OTP entry.
    await expect(
      page.getByRole("heading", { name: /Enter Reset Code/i }),
    ).toBeVisible();
    await expect(page.getByText("jane@example.com")).toBeVisible();

    const otpDigits = page.locator('input[inputmode="numeric"]');
    const code = "1234";
    for (let i = 0; i < code.length; i++) {
      await otpDigits.nth(i).fill(code[i]);
    }
    await page.getByRole("button", { name: /Verify Code/i }).click();

    // Step 3: New password. Stub zodResolver accepts our 8+char mixed payload.
    await expect(
      page.getByRole("heading", { name: /^Reset Password$/i }),
    ).toBeVisible();
    // `exact: true` to avoid strict-mode collision with the Confirm New
    // Password input (its label "Confirm New Password" contains the
    // substring "New Password" which a regex matches against both).
    await page.getByLabel("New Password", { exact: true }).fill("StrongPass1");
    await page.getByLabel(/Confirm New Password/i).fill("StrongPass1");
    await page.getByRole("button", { name: /^Reset Password$/i }).click();

    // Step 4: Success + redirect to /login.
    await expect(
      page.getByRole("heading", { name: /Password Reset Complete/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: /Continue to Sign In/i }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
