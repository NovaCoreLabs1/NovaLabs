import { Test, TestingModule } from '@nestjs/testing';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';

describe('ContactController', () => {
  let controller: ContactController;
  let contactService: any;

  const submitDto = {
    fullName: 'Alice Smith',
    email: 'alice@example.com',
    subject: 'Question',
    message: 'Hello, I have a question.',
  };

  beforeEach(async () => {
    contactService = {
      submit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContactController],
      providers: [{ provide: ContactService, useValue: contactService }],
    }).compile();

    controller = module.get<ContactController>(ContactController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('submit', () => {
    it('submits contact form and returns service result', async () => {
      contactService.submit.mockResolvedValue({
        message: 'Your message has been sent successfully.',
      });

      const req = { ip: '192.168.1.1', headers: {} };
      const result = await controller.submit(submitDto, req);

      expect(result).toEqual({
        message: 'Your message has been sent successfully.',
      });
      expect(contactService.submit).toHaveBeenCalledWith(
        submitDto,
        '192.168.1.1',
      );
    });

    it('extracts IP from x-forwarded-for header', async () => {
      contactService.submit.mockResolvedValue({
        message: 'Sent successfully.',
      });

      const req = {
        ip: '10.0.0.1',
        headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
      };
      await controller.submit(submitDto, req);

      expect(contactService.submit).toHaveBeenCalledWith(
        submitDto,
        '203.0.113.5',
      );
    });

    it('falls back to req.ip when x-forwarded-for is empty', async () => {
      contactService.submit.mockResolvedValue({
        message: 'Sent successfully.',
      });

      const req = { ip: '10.0.0.1', headers: { 'x-forwarded-for': '' } };
      await controller.submit(submitDto, req);

      expect(contactService.submit).toHaveBeenCalledWith(submitDto, '10.0.0.1');
    });

    it('passes null when both ip and x-forwarded-for are missing', async () => {
      contactService.submit.mockResolvedValue({
        message: 'Sent successfully.',
      });

      const req = { headers: {} };
      await controller.submit(submitDto, req);

      expect(contactService.submit).toHaveBeenCalledWith(submitDto, null);
    });
  });
});
