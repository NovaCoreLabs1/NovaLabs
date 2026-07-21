"use client";

import { useEffect, useState } from "react";
import CookieConsent, { getCookieConsentValue } from "react-cookie-consent";
import { CookieConsentValue } from "@/lib/hooks/useCookieConsent";

/**
 * SSR-safe cookie consent banner (GDPR Art. 7 + ePrivacy).
 *
 * Persists the user's choice in the `cookie_consent` cookie for one year
 * (both accept and decline are recorded so the banner does not re-appear).
 *
 * Persistence medium:
 *  - `cookie_consent=accept` (year-long, first-party)
 *  - `cookie_consent=decline` (year-long, first-party)
 *
 * Non-essential scripts (analytics, marketing) MUST listen for the
 * `consent_changed` window event emitted on accept/decline. See
 * `frontend/lib/hooks/useCookieConsent.ts` for the canonical gating pattern.
 *
 * Strictly necessary cookies (authAccessToken, authRefreshToken, csrf) are
 * NOT gated by this banner — they are set by the backend as HttpOnly cookies
 * on a legitimate-interest basis and are essential for the site to function.
 */
export function CookieBanner() {
  // Provide a stable initial value to avoid hydration flicker. After mount
  // we re-read the cookie in case a prior visit already persisted a choice.
  const [hydrated, setHydrated] = useState(false);
  const [currentValue, setCurrentValue] = useState<CookieConsentValue | null>(
    null,
  );

  useEffect(() => {
    const stored = getCookieConsentValue("cookie_consent");
    setCurrentValue(
      stored === "true"
        ? "accept"
        : stored === "false"
          ? "decline"
          : null,
    );
    setHydrated(true);
  }, []);

  // Once hydrated we dispatch the same event the library does, so any
  // analytics scripts that mounted without consent get a second chance to
  // bootstrap.
  useEffect(() => {
    if (!hydrated) return;
    if (currentValue === null) {
      window.dispatchEvent(new CustomEvent("consent_pending"));
    }
  }, [hydrated, currentValue]);

  const onAccept = () => {
    setCurrentValue("accept");
    window.dispatchEvent(
      new CustomEvent("consent_changed", { detail: "accept" }),
    );
  };

  const onDecline = () => {
    setCurrentValue("decline");
    window.dispatchEvent(
      new CustomEvent("consent_changed", { detail: "decline" }),
    );
  };

  return (
    <CookieConsent
      location="bottom"
      buttonText="Accept"
      declineButtonText="Decline"
      enableDeclineButton
      cookieName="cookie_consent"
      expires={365}
      overlay={false}
      onAccept={onAccept}
      onDecline={onDecline}
      style={{
        background: "#1f2937",
        color: "#f9fafb",
      }}
      buttonStyle={{
        background: "#f9fafb",
        color: "#1f2937",
        fontWeight: 600,
        borderRadius: 6,
        padding: "8px 16px",
        marginRight: 8,
      }}
      declineButtonStyle={{
        background: "transparent",
        color: "#f9fafb",
        border: "1px solid #f9fafb",
        borderRadius: 6,
        padding: "8px 16px",
      }}
      contentStyle={{ flex: "1 0 300px", margin: 8 }}
    >
      We use strictly-necessary cookies to keep the site secure and working.
      With your consent, we&apos;ll also use analytics cookies to understand how
      the site is used. You can change your choice anytime from the privacy
      settings.{" "}
      <a
        href="/privacy-policy"
        className="underline hover:text-white"
        style={{ marginLeft: 6 }}
      >
        Read our privacy policy
      </a>
    </CookieConsent>
  );
}

export default CookieBanner;
