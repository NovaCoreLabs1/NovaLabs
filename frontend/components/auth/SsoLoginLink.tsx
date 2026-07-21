"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Renders a small "or sign in with SSO" link that appears on the staff
 * login page only when the backend reports SAML is configured. The link
 * points at `/admin/sso/login` so staff users have an obvious path to the
 * IdP-discovery flow.
 */
export function SsoLoginLink({ className }: { className?: string }) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api";
    fetch(`${base}/auth/sso/status`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { enabled?: boolean } | null) => {
        setEnabled(Boolean(data?.enabled));
      })
      .catch(() => {
        // SSO not reachable — hide the link silently.
        setEnabled(false);
      });
  }, []);

  if (!enabled) return null;

  return (
    <Link
      href="/admin/sso/login"
      className={
        className ??
        "block text-center text-sm text-gray-700 hover:text-gray-900 underline"
      }
    >
      Sign in with SSO (Okta, Google Workspace, Entra ID)
    </Link>
  );
}

export default SsoLoginLink;
