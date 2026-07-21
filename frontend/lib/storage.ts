import { User } from "./types/user";

const AUTH_TOKEN_KEY = "authToken";
const AUTH_USER_KEY = "authUser";

/**
 * Client-side storage utilities for persisting auth state.
 * Stores the access token in localStorage for JS access and session restore.
 * Authentication cookies (HttpOnly) are set by the backend and sent automatically
 * by the browser — they are not readable or writable by client-side JavaScript.
 * All methods are SSR-safe and no-op when window is undefined.
 */
export const storage = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(AUTH_TOKEN_KEY);
  },

  setToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  },

  removeToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
  },

  getUser(): User | null {
    if (typeof window === "undefined") return null;
    const user = localStorage.getItem(AUTH_USER_KEY);
    return user ? JSON.parse(user) : null;
  },

  setUser(user: unknown): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
  },

  removeUser(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(AUTH_USER_KEY);
  },

  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
  },
};
