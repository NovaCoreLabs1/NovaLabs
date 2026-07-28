"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuthState } from "@/lib/store/authStore";

/**
 * Roles recognised by RoleGate.
 *
 * Mirrors `frontend/lib/types/user.ts > UserRole` and the lowercase strings
 * returned by the backend (`"user" | "admin"`).
 */
export type Role = "user" | "admin";

/**
 * Props for the {@link RoleGate} component.
 */
export interface RoleGateProps {
  /**
   * Minimum role required to render `children`.
   *
   * Current ordering is `user  <  admin`. Passing `role="admin"` hides the
   * subtree from regular users; passing `role="user"` renders for any role
   * at or above `user` (so admins also pass user-gated content).
   */
  role: Role;
  /**
   * Optional fallback to render when the current user does not meet the
   * role requirement, OR before client-side hydration completes (see
   * {@link RoleGate}).
   */
  fallback?: ReactNode;
  /**
   * Children to render when the role requirement is met.
   */
  children: ReactNode;
}

/**
 * Role hierarchy used by {@link RoleGate}.
 *
 * `admin` implies `user` — an administrator account passes a `role="user"`
 * gate by default, so legacy markup that already wrapped admin sections with
 * `<RoleGate role="user">` keeps rendering for staff.
 */
const ROLE_RANK: Record<Role, number> = {
  user: 1,
  admin: 2,
};

/**
 * Returns `true` only after the first client-side render has completed.
 *
 * `useAuthState()` is hydrated synchronously on the server (returning
 * `user: null, isAuthenticated: false`) and the actual session is restored
 * asynchronously from `localStorage` in `useAuthInit`.
 *
 * Without this guard, an admin user would see no `"Admin Console"` link on
 * the SSR pass and then have it appear post-hydration — a React hydration
 * mismatch (warning + content flash + a11y re-announce).
 */
function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}

/**
 * Renders `children` only if the currently authenticated user's role is at
 * least as privileged as the `role` prop.
 *
 * Behaviour
 * ---------
 *
 * 1. **Hydration safety.** Before the first client mount, RoleGate returns
 *    `fallback` (default `null`). This guarantees SSR HTML and the first
 *    client render agree byte-for-byte.
 *
 * 2. **Unauthenticated.** When `useAuthState().user` is `null`, RoleGate
 *    returns `fallback`. So a regular user never sees role-gated content,
 *    and a logged-out visitor sees nothing.
 *
 * 3. **Hierarchy.** It uses the `user < admin` ordering so admins satisfy
 *    `role="user"` gates. Use a different `role` value or a stricter
 *    `===` comparison if you want independent scopes.
 *
 * Implementation notes (issue #58):
 *
 * - Roles are sourced from the Zustand auth store (`useAuthState`) which the
 *   frontend already uses elsewhere. No new fetch is performed.
 * - Because `RoleGate` is a client component, callers must guard any
 *   server-side data fetches separately (the existing
 *   `useAuthRedirect(requiredRole="admin")` hook covers most cases).
 */
export function RoleGate({ role, fallback = null, children }: RoleGateProps) {
  const mounted = useHasMounted();
  const { user, isAuthenticated } = useAuthState();

  // Always defer role-gated rendering until the client has mounted to
  // avoid SSR hydration mismatches (see ACCEPTANCE: admin sees Admin
  // Console; guest never does).
  if (!mounted) return <>{fallback}</>;

  if (!isAuthenticated || !user) {
    return <>{fallback}</>;
  }

  const current = (user.role as Role | undefined) ?? "user";
  const required = ROLE_RANK[role];
  const have = ROLE_RANK[current] ?? 0;

  if (have < required) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

