/**
 * frontend/tests/e2e/security/csp.spec.ts — Issue #109
 *
 * Playwright smoke tests that assert:
 *  1. The server sends a Content-Security-Policy response header on every route.
 *  2. No CSP violation messages appear in the browser console while navigating
 *     the application's public routes.
 *
 * A failing test means a CSP directive is either missing or too tight
 * (blocking a legitimate resource such as Cloudinary images or Paystack JS).
 */

import { test, expect, ConsoleMessage } from "@playwright/test";

/** Public routes to probe — extend this list as new pages are added. */
const PUBLIC_ROUTES = [
  "/",
  "/bookings",
  "/contact",
  "/newsletter",
  "/privacy-policy",
  "/terms-of-service",
];

/**
 * Matches the browser's standard CSP-violation console messages.
 * Chrome: "Refused to load ... because it violates the following Content Security Policy directive"
 * Firefox: "Content Security Policy: The page's settings blocked the loading of a resource"
 */
const CSP_VIOLATION_RE =
  /refused to (load|execute|connect|frame|apply|eval)|content security policy/i;

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

test.describe("Content-Security-Policy smoke tests", () => {
  for (const route of PUBLIC_ROUTES) {
    test(`CSP header present on ${route}`, async ({ request }) => {
      const response = await request.get(`${BASE_URL}${route}`);
      const cspHeader =
        response.headers()["content-security-policy"] ??
        response.headers()["content-security-policy-report-only"];

      expect(
        cspHeader,
        `Expected Content-Security-Policy header on ${route}`
      ).toBeTruthy();

      // Must define at least a default-src directive
      expect(cspHeader).toMatch(/default-src/i);

      // frame-ancestors must be present and not include a wildcard
      expect(cspHeader).toMatch(/frame-ancestors/i);
      expect(cspHeader).not.toMatch(/frame-ancestors\s+['"]\*['"]/i);
    });
  }

  test("no CSP violations on the home page", async ({ page }) => {
    const violations: string[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      if (
        msg.type() === "error" &&
        CSP_VIOLATION_RE.test(msg.text())
      ) {
        violations.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

    expect(
      violations,
      `CSP violations detected on /:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });

  test("no CSP violations when navigating to bookings", async ({ page }) => {
    const violations: string[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      if (
        msg.type() === "error" &&
        CSP_VIOLATION_RE.test(msg.text())
      ) {
        violations.push(msg.text());
      }
    });

    await page.goto(`${BASE_URL}/bookings`, { waitUntil: "networkidle" });

    expect(
      violations,
      `CSP violations detected on /bookings:\n${violations.join("\n")}`
    ).toHaveLength(0);
  });

  test("CSP header blocks framing (X-Frame-Options)", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/`);
    const xFrameOptions = response.headers()["x-frame-options"];

    expect(
      xFrameOptions?.toUpperCase(),
      "Expected X-Frame-Options: DENY"
    ).toBe("DENY");
  });
});
