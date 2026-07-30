export interface JwtPayload {
  sub: string;
  email?: string;
  fullName?: string;
  role?: string;
  hubId?: string;
  iat?: number;
  exp?: number;
}
