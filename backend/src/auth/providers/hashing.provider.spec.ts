import { HashingProvider } from './hashing.provider';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('HashingProvider', () => {
  let provider: HashingProvider;

  beforeEach(() => {
    provider = new HashingProvider();
    jest.clearAllMocks();
  });

  describe('hash', () => {
    it('hashes a plain string using bcrypt with 10 salt rounds', async () => {
      (bcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashedvalue');

      const result = await provider.hash('plain-password');

      expect(bcrypt.hash).toHaveBeenCalledWith('plain-password', 10);
      expect(result).toBe('$2b$10$hashedvalue');
    });
  });

  describe('compare', () => {
    it('returns true when plain text matches hash', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await provider.compare(
        'plain-password',
        '$2b$10$hashedvalue',
      );

      expect(bcrypt.compare).toHaveBeenCalledWith(
        'plain-password',
        '$2b$10$hashedvalue',
      );
      expect(result).toBe(true);
    });

    it('returns false when plain text does not match hash', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await provider.compare(
        'wrong-password',
        '$2b$10$hashedvalue',
      );

      expect(result).toBe(false);
    });
  });
});
