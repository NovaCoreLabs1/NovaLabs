"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SsoStatus {
  enabled: boolean;
  issuer: string | null;
  callbackUrl: string | null;
  discoveryIdps: string[];
}

const IDP_LABELS: Record<string, { name: string; emoji: string }> = {
  okta: { name: "Okta", emoji: "🆗" },
  "google-workspace": { name: "Google Workspace", emoji: "🅖" },
  azure: { name: "Microsoft Entra ID", emoji: "Ⓜ️" },
};

function labelFor(idp: string): { name: string; emoji: string } {
  return (
    IDP_LABELS[idp] ?? { name: idp.replace(/-/g, " "), emoji: "🔐" }
  );
}

/**
 * Staff-facing SSO entry point.
 *
 * Probes `GET /api/auth/sso/status` to discover whether SAML is configured
 * and which IdPs the backend has whitelisted. If SAML is on, renders a
 * button per IdP that POSTs the SP-initiated redirect to `/auth/sso/login`.
 * Using a form (rather than window.location) keeps the user on the same
 * origin and lets the cookie middleware attach any pending CSRF token.
 */
export default function StaffSsoLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectAfter = searchParams.get("redirect") ?? "/admin/dashboard";

  const [status, setStatus] = useState<SsoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:6001/api";
    fetch(`${base}/auth/sso/status`, {
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`Status ${r.status}`);
        }
        return (await r.json()) as SsoStatus;
      })
      .then((s) => {
        setStatus(s);
        setLoading(false);
      })
      .catch((err) => {
        setError(err?.message ?? "Unable to reach SSO service");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-gray-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Checking SSO availability…
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-red-900">
          <h1 className="text-lg font-semibold">SSO Unavailable</h1>
          <p className="mt-2 text-sm">
            {error
              ? `Couldn't reach the SSO service: ${error}`
              : "The backend did not respond with SSO configuration."}
          </p>
        </div>
      </div>
    );
  }

  if (!status.enabled) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md rounded-lg border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-lg font-semibold">SSO Not Configured</h1>
          <p className="mt-2 text-sm">
            The NovaLabs backend has not been configured for SAML SSO. Set
            <code className="mx-1 rounded bg-amber-100 px-1">SAML_ENTRY_POINT</code>,
            <code className="mx-1 rounded bg-amber-100 px-1">SAML_ISSUER</code>,
            <code className="mx-1 rounded bg-amber-100 px-1">SAML_CALLBACK_URL</code>, and
            <code className="mx-1 rounded bg-amber-100 px-1">SAML_IDP_CERT</code>
            in the backend environment.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Staff Sign in with SSO
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Choose your organisation&apos;s identity provider. You&apos;ll be
          redirected to authenticate and then returned to the staff
          dashboard.
        </p>

        <form
          method="GET"
          action="/api/auth/sso/login"
          className="mt-6 space-y-3"
        >
          {/* Hidden field so we can later redirect back to where the
              user came from once the ACS round-trip lands. */}
          <input
            type="hidden"
            name="redirect"
            value={redirectAfter}
          />
          {status.discoveryIdps.map((idp) => {
            const meta = labelFor(idp);
            return (
              <Button
                key={idp}
                type="submit"
                name="idp"
                value={idp}
                variant="outline"
                size="lg"
                className="w-full justify-start gap-3 border-gray-300 hover:bg-gray-50"
              >
                <span aria-hidden>{meta.emoji}</span>
                <span>Continue with {meta.name}</span>
              </Button>
            );
          })}
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          Trouble signing in?{" "}
          <a href="mailto:staff@novalabs.app" className="underline">
            Contact your administrator
          </a>
        </div>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => router.push("/login")}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            ← Back to staff email login
          </button>
        </div>
      </div>
    </div>
  );
}
