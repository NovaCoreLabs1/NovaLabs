"use client";

import { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthState } from '../store/authStore';
import { User } from '@/lib/types/user';

interface AuthRedirectOptions {
  requireAuth?: boolean;
  requiredRole?: "admin" | "user";
  redirectTo?: string;
  redirectIfAuthenticated?: string;
}

interface AuthRedirectReturn {
  isLoading: boolean;
  isAuthenticated: boolean;
  user: User | null;
  canAccess: boolean;
}

/**
 * Hook that enforces route-level authentication and role-based access control.
 * Automatically redirects unauthenticated users to the login page and
 * users without the required role to the dashboard.
 *
 * @param options.requireAuth - Whether the route requires authentication (default: false)
 * @param options.requiredRole - Optional role required to access the route
 * @param options.redirectTo - Where to redirect unauthenticated users (default: '/auth/login')
 * @param options.redirectIfAuthenticated - Redirect authenticated users away (e.g. from /login)
 * @returns Auth state including isLoading, isAuthenticated, user, and canAccess
 */
export const useAuthRedirect = (options: AuthRedirectOptions = {}): AuthRedirectReturn => {
  const {
    requireAuth = false,
    requiredRole,
    redirectTo = '/auth/login',
    redirectIfAuthenticated
  } = options;

  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuthState();

  // Compute access permissions
  const canAccess = useMemo(() => {
    // If page doesn't require auth, anyone can access
    if (!requireAuth) return true;
    
    // If authentication is required but user is not authenticated
    if (requireAuth && !isAuthenticated) return false;
    
    // If specific role is required, check user role
    if (requiredRole && user?.role !== requiredRole) return false;
    
    return true;
  }, [requireAuth, isAuthenticated, requiredRole, user?.role]);

  useEffect(() => {
    // Don't redirect while loading
    if (isLoading) return;

    // Current path for redirect after login
    const currentPath = window.location.pathname;
    
    // Redirect authenticated users away from certain pages (like login)
    if (isAuthenticated && redirectIfAuthenticated) {
      const redirectPath = searchParams.get('redirect') || redirectIfAuthenticated;
      router.push(redirectPath);
      return;
    }

    // Redirect unauthenticated users to login
    if (requireAuth && !isAuthenticated) {
      const loginUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`;
      router.push(loginUrl);
      return;
    }

    // Redirect users without required role to dashboard
    if (isAuthenticated && requiredRole && user?.role !== requiredRole) {
      router.push('/dashboard');
      return;
    }
  }, [
    isLoading, 
    isAuthenticated, 
    requireAuth, 
    requiredRole, 
    user?.role, 
    redirectTo, 
    redirectIfAuthenticated, 
    router, 
    searchParams
  ]);

  return {
    isLoading,
    isAuthenticated,
    user,
    canAccess
  };
};
