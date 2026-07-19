import { Test, TestingModule } from '@nestjs/testing';
import { NewsletterProvider } from './subscription.provider';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NewsletterSubscriber } from '../entities/newsletter.entity';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { EmailService } from '../../email/email.service';

describe('NewsletterProvider', () => {
  let provider: NewsletterProvider;
  let repo: any;
  let emailService: any;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      softRemove: jest.fn(),
    };
    emailService = {
      sendTemplateEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsletterProvider,
        { provide: getRepositoryToken(NewsletterSubscriber), useValue: repo },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    provider = module.get<NewsletterProvider>(NewsletterProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  describe('subscribe', () => {
    it('creates a new subscriber and sends confirmation email', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({ email: 'alice@example.com' });
      repo.save.mockResolvedValue({
        id: 'sub-1',
        email: 'alice@example.com',
        subscribedAt: new Date(),
        isActive: false,
      });
      emailService.sendTemplateEmail.mockResolvedValue(true);

      const result = await provider.subscribe({
        email: 'alice@example.com',
        ipAddress: '192.168.1.1',
      });

      expect(result).toHaveProperty('id');
      expect(result.email).toBe('alice@example.com');
      expect(result.isActive).toBe(false);
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(emailService.sendTemplateEmail).toHaveBeenCalledWith(
        'alice@example.com',
        'Confirm your newsletter subscription',
        'newsletter-confirmation',
        expect.any(Object),
      );
    });

    it('throws ConflictException for already subscribed verified email', async () => {
      repo.findOne.mockResolvedValue({
        email: 'existing@example.com',
        isActive: true,
        isVerified: true,
        deletedAt: null,
      });

      await expect(
        provider.subscribe({ email: 'existing@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException on unique constraint violation', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({ email: 'test@example.com' });
      repo.save.mockRejectedValue({ code: '23505' });

      await expect(
        provider.subscribe({ email: 'test@example.com' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException for disposable email', async () => {
      await expect(
        provider.subscribe({ email: 'test@mailinator.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('re-activates soft-deleted subscriber', async () => {
      const deletedSub = {
        email: 'alice@example.com',
        isActive: false,
        isVerified: false,
        deletedAt: new Date(),
      };
      repo.findOne.mockResolvedValue(deletedSub);
      repo.save.mockResolvedValue({
        id: 'sub-1',
        email: 'alice@example.com',
        isActive: false,
      });
      emailService.sendTemplateEmail.mockResolvedValue(true);

      const result = await provider.subscribe({ email: 'alice@example.com' });

      expect(result).toBeDefined();
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ deletedAt: null }),
      );
    });

    it('trims and lowercases email', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue({ email: 'alice@example.com' });
      repo.save.mockResolvedValue({
        id: 's-1',
        email: 'alice@example.com',
        isActive: false,
      });
      emailService.sendTemplateEmail.mockResolvedValue(true);

      const result = await provider.subscribe({
        email: '  Alice@Example.com  ',
      });

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'alice@example.com' }),
      );
    });
  });

  describe('unsubscribe', () => {
    it('unsubscribes an active subscriber', async () => {
      repo.findOne.mockResolvedValue({
        id: 'sub-1',
        email: 'alice@example.com',
        isActive: true,
        unsubscribeToken: 'token-123',
        deletedAt: null,
      });
      repo.softRemove.mockResolvedValue({});
      emailService.sendTemplateEmail.mockResolvedValue(true);

      const result = await provider.unsubscribe({ token: 'token-123' });

      expect(result).toEqual({
        success: true,
        message: 'Unsubscribed successfully.',
      });
      expect(repo.softRemove).toHaveBeenCalled();
    });

    it('returns idempotent success for already unsubscribed', async () => {
      repo.findOne.mockResolvedValue({
        id: 'sub-1',
        email: 'alice@example.com',
        isActive: false,
        deletedAt: new Date(),
      });

      const result = await provider.unsubscribe({ token: 'token-123' });

      expect(result).toEqual({
        success: true,
        message: 'You are already unsubscribed.',
      });
      expect(repo.softRemove).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for invalid token', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        provider.unsubscribe({ token: 'invalid-token' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('confirm', () => {
    it('confirms a pending subscription', async () => {
      process.env.FRONTEND_URL = 'https://novalabs.com';
      repo.findOne.mockResolvedValue({
        id: 'sub-1',
        email: 'alice@example.com',
        isVerified: false,
        isActive: false,
        verificationToken: 'confirm-token',
        verificationTokenExpiresAt: new Date(Date.now() + 3600000),
        unsubscribeToken: 'unsub-token',
        deletedAt: null,
      });
      repo.save.mockResolvedValue({});
      emailService.sendTemplateEmail.mockResolvedValue(true);

      const result = await provider.confirm({ token: 'confirm-token' });

      expect(result).toEqual({
        success: true,
        message: 'Subscription confirmed successfully.',
      });
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isVerified: true,
          isActive: true,
          verifiedAt: expect.any(Date),
          verificationToken: null,
          verificationTokenExpiresAt: null,
        }),
      );
    });

    it('returns idempotent success for already confirmed', async () => {
      repo.findOne.mockResolvedValue({
        isVerified: true,
        isActive: true,
        deletedAt: null,
      });

      const result = await provider.confirm({ token: 'already-confirmed' });

      expect(result).toEqual({
        success: true,
        message: 'Subscription already confirmed.',
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for invalid token', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        provider.confirm({ token: 'invalid-token' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for expired token', async () => {
      repo.findOne.mockResolvedValue({
        isVerified: false,
        isActive: false,
        verificationTokenExpiresAt: new Date(Date.now() - 3600000),
        deletedAt: null,
      });

      await expect(
        provider.confirm({ token: 'expired-token' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for soft-deleted subscriber', async () => {
      repo.findOne.mockResolvedValue({
        isVerified: false,
        isActive: false,
        verificationTokenExpiresAt: new Date(Date.now() + 3600000),
        deletedAt: new Date(),
      });

      await expect(
        provider.confirm({ token: 'deleted-token' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
