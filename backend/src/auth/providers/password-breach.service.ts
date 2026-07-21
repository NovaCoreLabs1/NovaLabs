import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { createHash } from 'crypto';

const HIBP_API_BASE = 'https://api.pwnedpasswords.com/range';
const BREACH_THRESHOLD = 5;

@Injectable()
export class PasswordBreachService {
  private readonly logger = new Logger(PasswordBreachService.name);

  /**
   * Checks whether a plaintext password has appeared in known data breaches
   * using the HIBP k-anonymity model (only the SHA-1 prefix is sent).
   * @param password - The plaintext password to check
   * @throws BadRequestException if the password appears in more than 5 breaches
   */
  async checkPassword(password: string): Promise<void> {
    const sha1 = createHash('sha1')
      .update(password)
      .digest('hex')
      .toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    try {
      const { data } = await axios.get<string>(`${HIBP_API_BASE}/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        timeout: 5000,
      });

      const lines = data.split('\n');
      for (const line of lines) {
        const [hashSuffix, countStr] = line.split(':');
        if (hashSuffix.trim() === suffix) {
          const count = parseInt(countStr.trim(), 10);
          if (count > BREACH_THRESHOLD) {
            this.logger.warn(
              `Password rejected: found in ${count} known breaches`,
            );
            throw new BadRequestException(
              'This password has appeared in a known data breach. Please choose a different password.',
            );
          }
          return;
        }
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`HIBP API request failed: ${(error as Error).message}`);
    }
  }
}
