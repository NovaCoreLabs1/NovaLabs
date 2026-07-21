/**
 * IP address utilities for privacy-safe audit logging.
 *
 * IPv4 addresses are masked by zeroing the last octet so that the stored
 * value identifies the /24 network without pinpointing the individual host.
 * Example: 192.168.1.42 → 192.168.1.0
 *
 * IPv6 addresses are stored verbatim because they do not follow an octet
 * scheme and a meaningful subnet mask would require additional policy
 * decisions (e.g. /64 prefix). They should be treated as security-grade
 * data and follow the same short-retention path as raw IPv4 values.
 *
 * Invalid / null / undefined inputs return null so callers can safely
 * persist the result as a nullable column.
 */

/**
 * Returns a masked (last-octet-zeroed) version of an IPv4 address, or null
 * for invalid / empty input.
 *
 * @example
 * maskIpv4('203.0.113.42') // '203.0.113.0'
 * maskIpv4('::1')          // null  (IPv6 – use maskIp instead)
 * maskIpv4('')             // null
 */
export function maskIpv4(raw: string | null | undefined): string | null {
  if (!raw) return null;

  const trimmed = raw.trim();
  // Simple IPv4 pattern: four decimal octets separated by dots
  const ipv4Re = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/;
  const match = trimmed.match(ipv4Re);
  if (!match) return null;

  // Validate octet range
  const [, a, b, c] = match;
  if ([a, b, c].some((o) => parseInt(o, 10) > 255)) return null;

  return `${a}.${b}.${c}.0`;
}

/**
 * Returns true when the address is an IPv4 address.
 */
export function isIpv4(raw: string | null | undefined): boolean {
  return maskIpv4(raw) !== null;
}

/**
 * Returns true when the address is an IPv6 address (basic heuristic: contains
 * a colon and is not an IPv4-mapped form already handled by maskIpv4).
 */
export function isIpv6(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return raw.includes(':');
}

/**
 * Central helper used by the audit-log pipeline.
 *
 * - IPv4 → last octet zeroed (safe for routine logs)
 * - IPv6 → returned as-is (caller should route to security table)
 * - Invalid / empty → null
 */
export function maskIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (isIpv4(raw)) return maskIpv4(raw);
  if (isIpv6(raw)) return raw.trim(); // IPv6 kept verbatim
  return null;
}

/**
 * Determines whether an IP address value should be written to the short-
 * retention security table in addition to the (masked) routine audit log.
 *
 * Currently all IPv6 addresses are flagged because masking semantics for IPv6
 * are not defined, meaning the raw value would otherwise be stored in the
 * routine log unchanged.
 */
export function requiresSecurityRetention(
  raw: string | null | undefined,
): boolean {
  return isIpv6(raw);
}
