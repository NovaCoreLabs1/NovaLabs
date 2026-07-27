"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { FrontendFlags, readFrontendFlags } from '@/lib/feature-flags';

/**
 * Issue #39 — Frontend FeatureProvider.
 *
 * Single source of truth for client-side feature flags. The Provider
 * snapshots the env-var-driven flag list on mount so subsequent
 * renders see a stable snapshot. A `setFlag` setter is exposed for
 * the `/admin/feature-flags` page so admins can override a flag at
 * runtime in dev without a full rebuild (the override is in-memory
 * only — it is reset on a hard reload).
 *
 * The same flag names must be present in `frontend/lib/feature-flags.ts`'s
 * `FrontendFlags` interface and the backend
 * `backend/src/feature-flags/feature-flags.service.ts` default map.
 * A drift is detected at build time by the matching compile errors.
 */
const FeatureContext = createContext<{
  flags: FrontendFlags;
  setFlag: (key: keyof FrontendFlags, value: boolean) => void;
} | null>(null);

export function FeatureProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FrontendFlags>(() => readFrontendFlags());

  const setFlag = useCallback(
    (key: keyof FrontendFlags, value: boolean) => {
      setFlags((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const value = useMemo(() => ({ flags, setFlag }), [flags, setFlag]);

  return (
    <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>
  );
}

/**
 * Hook to read or mutate the active frontend feature-flag snapshot.
 * Throws if used outside a FeatureProvider — guard helps catch missed
 * wiring during refactors.
 */
export function useFeatureFlag<K extends keyof FrontendFlags>(key: K): boolean {
  const ctx = useContext(FeatureContext);
  if (!ctx) {
    throw new Error('useFeatureFlag must be used inside <FeatureProvider>');
  }
  return ctx.flags[key];
}

export function useFeatureFlags() {
  const ctx = useContext(FeatureContext);
  if (!ctx) {
    throw new Error('useFeatureFlags must be used inside <FeatureProvider>');
  }
  return ctx;
}
