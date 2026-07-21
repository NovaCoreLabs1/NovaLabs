"use client";

import { useEffect, useState } from "react";
import { getCookieConsentValue } from "react-cookie-consent";

export type CookieConsentValue = "accept" | "decline" | null;

const COOKIE_NAME = "cookie_consent";

/**
 * SSR-safe hook that returns the current cookie-consent value:
 *  - `"accept"` if the user has accepted non-essential cookies,
 *  - `"decline"` if they have explicitly declined,
 *  - `null` if no choice has been recorded yet.
 *
 * Components should not render analytics-tied UI until this returns an
 * accept value. The hook also re-reads on the `consent_changed` window
 * event so the user's preference flips immediately without a refresh.
 */
export function useCookieConsent(): CookieConsentValue {
  const [value, setValue] = useState<CookieConsentValue>(null);

  useEffect(() => {
    const read = () => {
      const stored = getCookieConsentValue(COOKIE_NAME);
      if (stored === "true") setValue("accept");
      else if (stored === "false") setValue("decline");
      else setValue(null);
    };

    read();
    const onChange = (event: Event) => {
      // Either the library dispatches `consent_changed` or another piece of
      // code mutates the cookie, so re-reading is the safe default.
      void event;
      read();
    };
    window.addEventListener("consent_changed", onChange as EventListener);
    return () => {
      window.removeEventListener(
        "consent_changed",
        onChange as EventListener,
      );
    };
  }, []);

  return value;
}

/**
 * Convenience helper for non-React code paths (e.g. bootstrapping analytics
 * or marketing tags outside of the React tree). Returns the current consent
 * state synchronously.
 */
export function readCurrentConsent(): CookieConsentValue {
  if (typeof document === "undefined") return null;
  const stored = getCookieConsentValue(COOKIE_NAME);
  if (stored === "true") return "accept";
  if (stored === "false") return "decline";
  return null;
}
