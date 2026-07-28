/** Application-level roles that determine a user's access permissions. */
export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

/** Account profile representing a registered platform user. */
export interface User {
  id: string;
  firstname: string;
  lastname: string;
  username?: string | null;
  email: string;
  role: "user" | "admin";
  isActive: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
  hasCompletedOnboarding: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Payload required to register a new user account. */
export interface RegisterUser {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
}

/** Credentials submitted by a user during authentication. */
export interface LoginUser {
  email: string;
  password: string;
  /**
   * When true, the client requests a longer-lived session. Forwarded to
   * the backend; ignored if the server does not negotiate remember-me.
   */
  rememberMe?: boolean;
}

/** Client-side authentication state for the current session. */
export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

/** Response payload returned by the auth API after a successful login. */
export interface AuthResponse {
  user: User;
  accessToken: string;
}
