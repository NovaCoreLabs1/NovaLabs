import { Response } from 'express';

/**
 * Shared helpers for managing the HttpOnly authentication cookies.
 *
 * The same cookie shape is set by `auth.controller.ts` (after email/password
 * login) and by `sso.controller.ts` after a successful SAML ACS round-trip,
 * so the SPA and any Bearer-header consumer see a uniform post-auth state.
 *
 * Cookies:
 *   - `authAccessToken`  — JWT access token (path=/)            maxAge: 1 day
 *   - `authRefreshToken` — JWT refresh token (path=/api/auth/refresh-token)
 *                                                            maxAge: 7 days
 *
 * Secure flag is enabled in production only; `sameSite=lax` is used so
 * top-level SAML redirects still flow.
 */

const isProduction = process.env.NODE_ENV === 'production';

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken?: string,
): void {
  res.cookie('authAccessToken', accessToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24, // 1 day
  });
  if (refreshToken) {
    res.cookie('authRefreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/api/auth/refresh-token',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  }
}

export function clearAuthCookies(res: Response): void {
  res.cookie('authAccessToken', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  res.cookie('authRefreshToken', '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/auth/refresh-token',
    maxAge: 0,
  });
}
