import { NextRequest, NextResponse } from "next/server";

/**
 * Authentication is now handled exclusively by the backend via HttpOnly
 * cookies and the frontend via Authorization: Bearer headers.
 *
 * Route-level redirects have been moved to component-level guards
 * (useAuthRedirect hook) which read the Zustand auth store.
 */
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
