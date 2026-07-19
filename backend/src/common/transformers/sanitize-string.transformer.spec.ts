import { SanitizeString } from './sanitize-string.transformer';
import { Transform } from 'class-transformer';

jest.mock('class-transformer', () => ({
  Transform: jest.fn((transformFn: any) => transformFn),
}));

describe('SanitizeString', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(SanitizeString).toBeDefined();
  });

  it('calls Transform with a function', () => {
    SanitizeString();
    expect(Transform).toHaveBeenCalledWith(expect.any(Function));
  });

  describe('transform function behavior', () => {
    let transformFn: (params: { value: any }) => any;

    beforeEach(() => {
      (Transform as jest.Mock).mockClear();
      SanitizeString();
      transformFn = (Transform as jest.Mock).mock.calls[0][0];
    });

    it('trims leading and trailing whitespace', () => {
      const result = transformFn({ value: '  hello world  ' });
      expect(result).toBe('hello world');
    });

    it('removes ASCII control characters', () => {
      const result = transformFn({ value: 'hello\x00world\x1Ftest' });
      expect(result).toBe('helloworldtest');
    });

    it('removes script tags (case-insensitive)', () => {
      const result = transformFn({
        value: '<script>alert("xss")</script>hello',
      });
      expect(result).toBe('alert("xss")hello');
    });

    it('removes self-closing script tags', () => {
      const result = transformFn({ value: 'before<script src="evil.js"/>after' });
      expect(result).toBe('beforeafter');
    });

    it('removes uppercase script tags', () => {
      const result = transformFn({ value: '<SCRIPT>evil</SCRIPT>' });
      expect(result).toBe('evil');
    });

    it('collapses multiple spaces into one', () => {
      const result = transformFn({ value: 'hello    world   test' });
      expect(result).toBe('hello world test');
    });

    it('applies all sanitization steps in sequence', () => {
      const result = transformFn({
        value: '  <script>alert(1)</script>  hello\x00  world  ',
      });
      expect(result).toBe('alert(1) hello world');
    });

    it('returns non-string values unchanged', () => {
      expect(transformFn({ value: 123 })).toBe(123);
      expect(transformFn({ value: null })).toBe(null);
      expect(transformFn({ value: undefined })).toBe(undefined);
      expect(transformFn({ value: {} })).toEqual({});
      expect(transformFn({ value: [] })).toEqual([]);
      expect(transformFn({ value: true })).toBe(true);
    });

    it('returns empty string unchanged', () => {
      const result = transformFn({ value: '' });
      expect(result).toBe('');
    });

    it('removes only control characters leaving normal punctuation', () => {
      const result = transformFn({
        value: 'hello!@#$%^&*()_+-=[]{}|;:,.<>?world',
      });
      expect(result).toBe('hello!@#$%^&*()_+-=[]{}|;:,.<>?world');
    });
  });
});
