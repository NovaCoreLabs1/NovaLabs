import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { ConfigService } from '@nestjs/config';

// Mock nodemailer
const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendMail,
  })),
}));

// Mock handlebars
jest.mock('handlebars', () => ({
  compile: jest.fn(() => jest.fn(() => '<html>rendered</html>')),
}));

// Mock fs
jest.mock('fs', () => ({
  readFileSync: jest.fn(() => '{{fullName}} template content'),
}));

describe('EmailService', () => {
  let service: EmailService;
  let configService: any;

  beforeEach(async () => {
    mockSendMail.mockReset();
    configService = {
      get: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendVerificationEmail', () => {
    it('sends verification OTP email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendVerificationEmail(
        'alice@example.com',
        '123456',
        'Alice Smith',
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          subject: 'Verify Your Email',
          from: 'noreply@novalabs.com',
        }),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset OTP email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendPasswordResetEmail(
        'alice@example.com',
        '654321',
        'Alice Smith',
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          subject: 'Password Reset Code',
        }),
      );
    });
  });

  describe('sendVerificationLinkEmail', () => {
    it('sends verification link with frontend URL', async () => {
      configService.get
        .mockReturnValueOnce('noreply@novalabs.com')
        .mockReturnValueOnce('https://novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendVerificationLinkEmail(
        'alice@example.com',
        'token-123',
        'Alice Smith',
      );

      expect(result).toBe(true);
    });

    it('uses empty string when FRONTEND_URL is not set', async () => {
      configService.get
        .mockReturnValueOnce('noreply@novalabs.com')
        .mockReturnValueOnce('');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendVerificationLinkEmail(
        'alice@example.com',
        'token-123',
        'Alice',
      );

      expect(result).toBe(true);
    });
  });

  describe('sendPasswordResetLinkEmail', () => {
    it('sends password reset link email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendPasswordResetLinkEmail(
        'alice@example.com',
        'Alice Smith',
        'https://novalabs.com/reset?token=abc',
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          subject: 'Reset Your Password',
        }),
      );
    });
  });

  describe('sendPasswordResetSuccessEmail', () => {
    it('sends password reset success email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendPasswordResetSuccessEmail(
        'alice@example.com',
        'Alice Smith',
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'alice@example.com',
          subject: 'Password Reset Successful',
        }),
      );
    });
  });

  describe('sendTemplateEmail', () => {
    it('sends email with custom template', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendTemplateEmail(
        'alice@example.com',
        'Custom Subject',
        'custom-template',
        { fullName: 'Alice' },
      );

      expect(result).toBe(true);
    });
  });

  describe('sendContactConfirmation', () => {
    it('sends contact confirmation email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendContactConfirmation(
        'alice@example.com',
        'Alice Smith',
        'Question',
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'We received your message',
        }),
      );
    });
  });

  describe('sendContactNotification', () => {
    it('sends admin notification using ADMIN_EMAIL', async () => {
      configService.get
        .mockReturnValueOnce('admin@novalabs.com')
        .mockReturnValueOnce('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendContactNotification(
        'Alice Smith',
        'alice@example.com',
        'Question',
        'Message body',
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@novalabs.com',
        }),
      );
    });

    it('falls back to EMAIL_FROM when ADMIN_EMAIL is not set', async () => {
      configService.get
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendContactNotification(
        'Alice Smith',
        'alice@example.com',
        'Question',
        'Message body',
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'noreply@novalabs.com',
        }),
      );
    });
  });

  describe('sendInvoiceReadyEmail', () => {
    it('sends invoice email with PDF attachment', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendInvoiceReadyEmail(
        'alice@example.com',
        'Alice Smith',
        { invoiceNumber: 'INV-001', amountNaira: '5000', paidAt: '2024-01-15' },
        Buffer.from('pdf content'),
      );

      expect(result).toBe(true);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          attachments: expect.arrayContaining([
            expect.objectContaining({
              filename: 'INV-001.pdf',
              contentType: 'application/pdf',
            }),
          ]),
        }),
      );
    });
  });

  describe('sendBookingCreatedEmail', () => {
    it('sends booking confirmation email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendBookingCreatedEmail(
        'alice@example.com',
        'Alice Smith',
        {
          bookingId: 'booking-1',
          workspaceName: 'Desk A',
          planType: 'monthly',
          startDate: '2024-02-01',
          endDate: '2024-03-01',
          seatCount: 1,
          totalAmountNaira: '50000',
        },
      );

      expect(result).toBe(true);
    });
  });

  describe('sendPaymentSuccessEmail', () => {
    it('sends payment success email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendPaymentSuccessEmail(
        'alice@example.com',
        'Alice Smith',
        {
          bookingId: 'booking-1',
          workspaceName: 'Desk A',
          amountNaira: '50000',
          paidAt: '2024-02-01',
          invoiceNumber: 'INV-001',
        },
      );

      expect(result).toBe(true);
    });
  });

  describe('sendPaymentFailedEmail', () => {
    it('sends payment failed email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendPaymentFailedEmail(
        'alice@example.com',
        'Alice Smith',
        {
          paymentReference: 'ref-123',
          amountNaira: '50000',
        },
      );

      expect(result).toBe(true);
    });
  });

  describe('sendBookingCancelledEmail', () => {
    it('sends booking cancelled email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendBookingCancelledEmail(
        'alice@example.com',
        'Alice Smith',
        {
          bookingId: 'booking-1',
          workspaceName: 'Desk A',
          startDate: '2024-02-01',
          endDate: '2024-03-01',
          cancelledBy: 'admin',
        },
      );

      expect(result).toBe(true);
    });
  });

  describe('sendRefreshTokenFamilyRevokedEmail', () => {
    it('sends session revocation email', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockResolvedValue({ accepted: true });

      const result = await service.sendRefreshTokenFamilyRevokedEmail(
        'alice@example.com',
        'Alice Smith',
      );

      expect(result).toBe(true);
    });
  });

  describe('sendMail error handling', () => {
    it('returns false when sendMail throws', async () => {
      configService.get.mockReturnValue('noreply@novalabs.com');
      mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

      const result = await service.sendVerificationEmail(
        'alice@example.com',
        '123456',
        'Alice',
      );

      expect(result).toBe(false);
    });
  });
});
