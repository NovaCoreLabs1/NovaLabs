/// <reference types="jest" />
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { HandleWebhookProvider } from './handle-webhook.provider';
import { PaystackProvider } from './paystack.provider';
import { SorobanEscrowProvider } from './soroban-escrow.provider';
import { BookingsService } from '../../bookings/bookings.service';
import { InvoicesService } from '../../invoices/invoices.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { EmailService } from '../../email/email.service';
import { Payment } from '../entities/payment.entity';
import { Booking } from '../../bookings/entities/booking.entity';
import { User } from '../../users/entities/user.entity';

function mockRepository() {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  };
}

function createEventPayload(eventType: string, reference: string) {
  return Buffer.from(JSON.stringify({ event: eventType, data: { reference } }));
}

describe('HandleWebhookProvider – replay protection', () => {
  let provider: HandleWebhookProvider;
  let paystackProvider: jest.Mocked<PaystackProvider>;

  beforeEach(async () => {
    paystackProvider = {
      verifyWebhookSignature: jest.fn().mockReturnValue(true),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HandleWebhookProvider,
        { provide: getRepositoryToken(Payment), useValue: mockRepository() },
        { provide: getRepositoryToken(Booking), useValue: mockRepository() },
        { provide: getRepositoryToken(User), useValue: mockRepository() },
        { provide: PaystackProvider, useValue: paystackProvider },
        { provide: SorobanEscrowProvider, useValue: {} },
        { provide: BookingsService, useValue: { confirm: jest.fn() } },
        {
          provide: InvoicesService,
          useValue: { generateForPayment: jest.fn() },
        },
        {
          provide: NotificationsService,
          useValue: { create: jest.fn() },
        },
        { provide: EmailService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    provider = module.get<HandleWebhookProvider>(HandleWebhookProvider);
  });

  it('should accept webhook with recent timestamp', async () => {
    const body = createEventPayload('charge.success', 'ref-1');
    const recentTime = new Date(Date.now() - 30_000).toISOString(); // 30s ago

    await expect(
      provider.handle(body, 'sig', recentTime),
    ).resolves.toBeUndefined();
  });

  it('should accept webhook with no timestamp (backward compat)', async () => {
    const body = createEventPayload('charge.success', 'ref-1');

    await expect(provider.handle(body, 'sig', '')).resolves.toBeUndefined();
  });

  it('should reject webhook older than 5 minutes', async () => {
    const body = createEventPayload('charge.success', 'ref-1');
    const oldTime = new Date(Date.now() - 6 * 60_000).toISOString(); // 6 min ago

    await expect(provider.handle(body, 'sig', oldTime)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject webhook with timestamp in the future beyond threshold', async () => {
    const body = createEventPayload('charge.success', 'ref-1');
    const futureTime = new Date(Date.now() + 6 * 60_000).toISOString(); // 6 min future

    await expect(provider.handle(body, 'sig', futureTime)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject webhook with invalid timestamp format', async () => {
    const body = createEventPayload('charge.success', 'ref-1');

    await expect(provider.handle(body, 'sig', 'not-a-date')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should accept webhook within 5-minute boundary', async () => {
    const body = createEventPayload('charge.success', 'ref-1');
    const edgeTime = new Date(Date.now() - 5 * 60_000 + 1000).toISOString(); // 4m59s ago

    await expect(
      provider.handle(body, 'sig', edgeTime),
    ).resolves.toBeUndefined();
  });
});
