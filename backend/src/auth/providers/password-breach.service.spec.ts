/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { PasswordBreachService } from './password-breach.service';
import axios from 'axios';
import { createHash } from 'crypto';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('PasswordBreachService', () => {
  let service: PasswordBreachService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PasswordBreachService],
    }).compile();

    service = module.get<PasswordBreachService>(PasswordBreachService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkPassword', () => {
    it('should pass when password is not found in breaches', async () => {
      mockedAxios.get.mockResolvedValue({
        data: 'AAAAAA00000000000:0\nBBBBBB1111111111:0\n',
      });

      await expect(
        service.checkPassword('a-safe-password'),
      ).resolves.toBeUndefined();
    });

    it('should throw BadRequestException when password is in >5 breaches', async () => {
      const sha1 = createHash('sha1')
        .update('password123')
        .digest('hex')
        .toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);

      mockedAxios.get.mockResolvedValue({
        data: `${suffix}:10\n`,
      });

      await expect(service.checkPassword('password123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should pass when password breach count is <=5', async () => {
      const sha1 = createHash('sha1')
        .update('somewhat-safe')
        .digest('hex')
        .toUpperCase();
      const prefix = sha1.slice(0, 5);
      const suffix = sha1.slice(5);

      mockedAxios.get.mockResolvedValue({
        data: `${suffix}:3\n`,
      });

      await expect(
        service.checkPassword('somewhat-safe'),
      ).resolves.toBeUndefined();
    });

    it('should pass when HIBP API returns empty response', async () => {
      mockedAxios.get.mockResolvedValue({ data: '' });

      await expect(
        service.checkPassword('unique-password'),
      ).resolves.toBeUndefined();
    });

    it('should not throw when HIBP API request fails (graceful degradation)', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      await expect(
        service.checkPassword('some-password'),
      ).resolves.toBeUndefined();
    });

    it('should query the correct HIBP endpoint with Add-Padding header', async () => {
      mockedAxios.get.mockResolvedValue({ data: '' });

      await service.checkPassword('test-password');

      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
      const [url, config] = mockedAxios.get.mock.calls[0];
      expect(url).toMatch(
        /^https:\/\/api\.pwnedpasswords\.com\/range\/[A-F0-9]{5}$/,
      );
      expect(config).toHaveProperty('headers.Add-Padding', 'true');
    });
  });
});
