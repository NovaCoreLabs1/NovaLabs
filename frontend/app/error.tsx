"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, Home, RefreshCw, SearchX, Bug } from "lucide-react";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Issue #54 — 500 / Error UX.
 *
 * Visually consistent with `not-found.tsx` (same purple-pink gradient,
 * concentric icon ring, lucide icons, gradient headline). Adds:
 *
 *  - An "Error Reference ID" panel that doubles as the Sentry event id
 *    when one is available (Next.js exposes the matching digest).
 *  - A "Report this error" call-to-action that opens an email compose
 *    for environments where Sentry is offline.
 *  - A search-style input that mirrors the 404 page so a stuck user has
 *    a discoverable escape hatch without scrolling.
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Forward to whichever error-reporting sink is configured at runtime.
    console.error("Application error:", error);
  }, [error]);

  const handleReload = () => {
    // Last-resort escape hatch — some 500 responses leave the React tree
    // in a state that refuses to re-render under `reset()`. Hard-reload
    // is the simplest recovery for the stuck user.
    window.location.reload();
  };

    // Forward the error to whatever error-reporting service is wired up
    // at runtime. Next.js populates `error.digest` from the React server
    // runtime and it matches the Sentry event id we capture server-side
    // when `@sentry/nextjs` is configured.
    console.error("Application error:", error);
  }, [error]);
  useEffect(() => {
    // Forward the error to whatever error-reporting service is wired up
    // at runtime. Next.js populates `error.digest` from the React server
    // runtime and it matches the Sentry event id we capture server-side
    // when `@sentry/nextjs` is configured.
    console.error("Application error:", error);
  }, [error]);

  const sentryId =
    typeof error.digest === "string" ? error.digest : undefined;
  const subject = encodeURIComponent(
    `NovaLabs error report${sentryId ? ` (${sentryId})` : ""}`,
  );
  const body = encodeURIComponent(
    `Error ID: ${sentryId ?? "unknown"}\nMessage: ${error.message ?? ""}\nURL: ${
      typeof window !== "undefined" ? window.location.href : ""
    }`,
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Concentric ring icon — matches not-found.tsx */}
        <div className="relative inline-block">
          <div className="absolute inset-0 bg-purple-200 rounded-full blur-3xl opacity-30 animate-pulse" />
          <div className="relative bg-white rounded-full p-4 sm:p-6 md:p-8 shadow-xl">
            <AlertTriangle
              className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 text-purple-600 mx-auto"
              strokeWidth={1.5}
            />
          </div>
        </div>

        {/* Headline — purple→pink gradient text */}
        <div className="space-y-2">
          <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            500
          </h1>
          <div className="h-1 w-24 bg-gradient-to-r from-purple-600 to-pink-600 mx-auto rounded-full" />
        </div>

        {/* Copy */}
        <div className="space-y-3">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
            Something went wrong on our end
          </h2>
          <p className="text-lg text-gray-600 max-w-md mx-auto leading-relaxed">
            We&rsquo;ve been notified automatically. You can safely retry the
            page, or report this with the reference id below.
          </p>
        </div>

        {/* Stack of action buttons — same family of pill buttons as 404 */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={reset}
            className="group flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium px-8 py-4 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:scale-105"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Try Again</span>
          </button>

          <button
            onClick={handleReload}
            aria-label="Hard reload"
            className="group flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-900 font-medium px-8 py-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Reload Page</span>
          </button>

          <Link
            href="/"
            className="group flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-900 font-medium px-8 py-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg border border-gray-200"
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
        </div>

        {/* Sentry / Error Reference panel — the critical AC for Issue #54 */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl border border-gray-200 shadow-sm p-4 text-left max-w-md mx-auto">
          <div className="flex items-center gap-2 text-gray-800">
            <Bug className="w-4 h-4 text-purple-600" />
            <span className="font-semibold text-sm">
              Error Reference{sentryId ? "" : " (pending)"}
            </span>
          </div>
          {sentryId ? (
            <code className="block mt-2 font-mono text-xs text-gray-700 break-all">
              {sentryId}
            </code>
          ) : (
            <p className="mt-2 text-xs text-gray-500">
              Reference id will be assigned as soon as the error has been
              reported.
            </p>
          )}
          {sentryId && (
            <a
              href={`mailto:support@novalabs.app?subject=${subject}&body=${body}`}
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-purple-600 hover:text-purple-700"
            >
              Report this error →
            </a>
          )}
        </div>

        {/* Search-style escape hatch — matches 404 visual language */}
        <form
          action="/search"
          className="max-w-md mx-auto pt-2"
          role="search"
          aria-label="Search NovaLabs"
        >
          <div className="relative">
            <SearchX
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              aria-hidden="true"
            />
            <input
              type="search"
              name="q"
              placeholder="Search workspaces, bookings, dashboards…"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </form>

        {/* Dev-only error details — kept from the original page */}
        {process.env.NODE_ENV === "development" && (
          <details className="bg-gray-50 border rounded-lg p-4 text-left max-w-lg mx-auto">
            <summary className="cursor-pointer font-medium text-gray-700">
              Error Details (dev only)
            </summary>
            <div className="mt-3 space-y-2 text-sm">
              <div>
                <strong>Message:</strong> {error.message || "Unknown error"}
              </div>
              {error.digest && (
                <div>
                  <strong>ID:</strong>{" "}
                  <code className="bg-gray-200 px-1 rounded">
                    {error.digest}
                  </code>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}
