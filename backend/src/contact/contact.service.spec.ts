import { Test, TestingModule } from '@nestjs/testing';
import { ContactService } from './contact.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContactMessage } from './entities/contact-message.entity';
import { EmailService } from '../email/email.service';
import { Logger } from '@nestjs/common';

describe('ContactService', () => {
  let service: ContactService;
  let contactRepo: any;
  let emailService: any;
  let loggerWarnSpy: jest.SpyInstance;

  const submitDto = {
    fullName: 'Alice Smith',
    email: 'alice@example.com',
    subject: 'Question about pricing',
    message: 'I would like to know more about your premium plans.',
  };

  beforeEach(async () => {
    contactRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    emailService = {
      sendContactConfirmation: jest.fn(),
      sendContactNotification: jest.fn(),
    };

    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactService,
        { provide: getRepositoryToken(ContactMessage), useValue: contactRepo },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get<ContactService>(ContactService);
  });

  afterEach(() => {
    loggerWarnSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('submit', () => {
    it('saves contact message and sends both emails', async () => {
      const createdEntity = { id: 'msg-1', ...submitDto };
      contactRepo.create.mockReturnValue(createdEntity);
      contactRepo.save.mockResolvedValue(createdEntity);
      emailService.sendContactConfirmation.mockResolvedValue(true);
      emailService.sendContactNotification.mockResolvedValue(true);

      const result = await service.submit(submitDto);

      expect(result).toEqual({
        message: 'Your message has been sent successfully.',
      });
      expect(contactRepo.create).toHaveBeenCalledWith({
        ...submitDto,
        ipAddress: undefined,
      });
      expect(contactRepo.save).toHaveBeenCalledWith(createdEntity);
      expect(emailService.sendContactConfirmation).toHaveBeenCalledWith(
        'alice@example.com',
        'Alice Smith',
        'Question about pricing',
      );
      expect(emailService.sendContactNotification).toHaveBeenCalledWith(
        'Alice Smith',
        'alice@example.com',
        'Question about pricing',
        'I would like to know more about your premium plans.',
      );
    });

    it('includes IP address when provided', async () => {
      contactRepo.create.mockReturnValue({});
      contactRepo.save.mockResolvedValue({});
      emailService.sendContactConfirmation.mockResolvedValue(true);
      emailService.sendContactNotification.mockResolvedValue(true);

      await service.submit(submitDto, '192.168.1.1');

      expect(contactRepo.create).toHaveBeenCalledWith({
        ...submitDto,
        ipAddress: '192.168.1.1',
      });
    });

    it('handles null IP address gracefully', async () => {
      contactRepo.create.mockReturnValue({});
      contactRepo.save.mockResolvedValue({});
      emailService.sendContactConfirmation.mockResolvedValue(true);
      emailService.sendContactNotification.mockResolvedValue(true);

      await service.submit(submitDto, null);

      expect(contactRepo.create).toHaveBeenCalledWith({
        ...submitDto,
        ipAddress: undefined,
      });
    });

    it('does not throw when confirmation email fails (fire-and-forget)', async () => {
      contactRepo.create.mockReturnValue({ id: 'msg-1' });
      contactRepo.save.mockResolvedValue({ id: 'msg-1' });
      emailService.sendContactConfirmation.mockRejectedValue(
        new Error('SMTP error'),
      );
      emailService.sendContactNotification.mockResolvedValue(true);

      const result = await service.submit(submitDto);

      expect(result.message).toBe('Your message has been sent successfully.');
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send contact confirmation'),
      );
    });

    it('does not throw when admin notification fails (fire-and-forget)', async () => {
      contactRepo.create.mockReturnValue({ id: 'msg-1' });
      contactRepo.save.mockResolvedValue({ id: 'msg-1' });
      emailService.sendContactConfirmation.mockResolvedValue(true);
      emailService.sendContactNotification.mockRejectedValue(
        new Error('SMTP error'),
      );

      const result = await service.submit(submitDto);

      expect(result.message).toBe('Your message has been sent successfully.');
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send admin notification'),
      );
    });

    it('re-throws when repository save fails', async () => {
      contactRepo.create.mockReturnValue({});
      contactRepo.save.mockRejectedValue(new Error('DB error'));

      await expect(service.submit(submitDto)).rejects.toThrow('DB error');
    });
  });
});
