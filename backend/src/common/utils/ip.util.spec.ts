import {
  maskIpv4,
  maskIp,
  isIpv4,
  isIpv6,
  requiresSecurityRetention,
} from './ip.util';

describe('ip.util', () => {
  // ---------------------------------------------------------------------------
  // maskIpv4
  // ---------------------------------------------------------------------------
  describe('maskIpv4', () => {
    it('zeros the last octet of a standard IPv4 address', () => {
      expect(maskIpv4('203.0.113.42')).toBe('203.0.113.0');
    });

    it('handles addresses where the last octet is already 0', () => {
      expect(maskIpv4('10.0.0.0')).toBe('10.0.0.0');
    });

    it('handles loopback address', () => {
      expect(maskIpv4('127.0.0.1')).toBe('127.0.0.0');
    });

    it('handles private RFC-1918 ranges', () => {
      expect(maskIpv4('192.168.1.100')).toBe('192.168.1.0');
      expect(maskIpv4('10.20.30.40')).toBe('10.20.30.0');
      expect(maskIpv4('172.16.254.1')).toBe('172.16.254.0');
    });

    it('returns null for an IPv6 address', () => {
      expect(maskIpv4('::1')).toBeNull();
      expect(maskIpv4('2001:db8::1')).toBeNull();
    });

    it('returns null for null input', () => {
      expect(maskIpv4(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(maskIpv4(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(maskIpv4('')).toBeNull();
    });

    it('returns null for arbitrary non-IP strings', () => {
      expect(maskIpv4('not-an-ip')).toBeNull();
    });

    it('trims whitespace before processing', () => {
      expect(maskIpv4('  192.168.0.5  ')).toBe('192.168.0.0');
    });

    it('returns null for an address with an octet > 255', () => {
      // 256 fails the range check
      expect(maskIpv4('256.0.0.1')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // isIpv4 / isIpv6
  // ---------------------------------------------------------------------------
  describe('isIpv4', () => {
    it('returns true for a valid IPv4 address', () => {
      expect(isIpv4('1.2.3.4')).toBe(true);
    });

    it('returns false for an IPv6 address', () => {
      expect(isIpv4('::1')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isIpv4(null)).toBe(false);
    });
  });

  describe('isIpv6', () => {
    it('returns true for loopback IPv6', () => {
      expect(isIpv6('::1')).toBe(true);
    });

    it('returns true for a full IPv6 address', () => {
      expect(isIpv6('2001:db8::dead:beef')).toBe(true);
    });

    it('returns false for a plain IPv4 address', () => {
      expect(isIpv6('1.2.3.4')).toBe(false);
    });

    it('returns false for null', () => {
      expect(isIpv6(null)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // maskIp (central helper)
  // ---------------------------------------------------------------------------
  describe('maskIp', () => {
    it('masks IPv4 correctly', () => {
      expect(maskIp('203.0.113.42')).toBe('203.0.113.0');
    });

    it('returns IPv6 verbatim', () => {
      expect(maskIp('2001:db8::1')).toBe('2001:db8::1');
    });

    it('returns null for empty string', () => {
      expect(maskIp('')).toBeNull();
    });

    it('returns null for null', () => {
      expect(maskIp(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(maskIp(undefined)).toBeNull();
    });

    it('returns null for a garbage string', () => {
      expect(maskIp('foo.bar')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // requiresSecurityRetention
  // ---------------------------------------------------------------------------
  describe('requiresSecurityRetention', () => {
    it('returns true for IPv6 addresses', () => {
      expect(requiresSecurityRetention('::1')).toBe(true);
      expect(requiresSecurityRetention('2001:db8::1')).toBe(true);
    });

    it('returns false for IPv4 addresses', () => {
      expect(requiresSecurityRetention('1.2.3.4')).toBe(false);
    });

    it('returns false for null', () => {
      expect(requiresSecurityRetention(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(requiresSecurityRetention(undefined)).toBe(false);
    });
  });
});
