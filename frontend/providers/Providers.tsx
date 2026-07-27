"use client";

import ReactQueryProvider from "./ReactQueryProvider";
import { AuthInitializerProvider } from "./authInitializer"; // import the new provider
import { FeatureProvider } from "./FeatureProvider"; // Issue #39 feature flags

/**
 * Root provider tree for the NovaLabs frontend.
 * Composes ReactQueryProvider (for data fetching), AuthInitializerProvider
 * (for session restoration) and FeatureProvider (for client-side feature
 * flags) in the correct order. FeatureProvider is intentionally OUTSIDE
 * AuthInitializer so test fixtures that render <FeatureProvider> alone
 * can mount without the auth API client.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ReactQueryProvider>
      <AuthInitializerProvider>
        <FeatureProvider>{children}</FeatureProvider>
      </AuthInitializerProvider>
    </ReactQueryProvider>
  );
}
