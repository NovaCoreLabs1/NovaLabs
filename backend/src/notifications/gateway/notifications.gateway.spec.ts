import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from './notifications.gateway';
import { JwtService } from '@nestjs/jwt';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;
  let jwtService: jest.Mocked<Partial<JwtService>>;

  beforeEach(async () => {
    jwtService = {
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsGateway,
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
    // Mock the server
    (gateway as any).server = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
  });

  describe('sendToUser', () => {
    it('emits event to the users socket room', () => {
      const data = { id: 'notif-1', title: 'Test' };

      gateway.sendToUser('user-1', 'notification', data);

      expect((gateway as any).server.to).toHaveBeenCalledWith('user:user-1');
      expect((gateway as any).server.emit).toHaveBeenCalledWith(
        'notification',
        data,
      );
    });
  });

  describe('handleConnection', () => {
    let mockClient: any;

    beforeEach(() => {
      mockClient = {
        id: 'socket-1',
        handshake: { auth: {}, headers: {} },
        join: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn(),
      };
    });

    it('disconnects client without a token', async () => {
      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
      expect(mockClient.join).not.toHaveBeenCalled();
    });

    it('disconnects client with an invalid token', async () => {
      mockClient.handshake.auth = { token: 'bad-token' };
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await gateway.handleConnection(mockClient);

      expect(mockClient.disconnect).toHaveBeenCalled();
    });

    it('joins user room with valid token from auth', async () => {
      mockClient.handshake.auth = { token: 'valid-token' };
      jwtService.verify.mockReturnValue({ sub: 'user-1' });

      await gateway.handleConnection(mockClient);

      expect(mockClient.join).toHaveBeenCalledWith('user:user-1');
      expect(mockClient.disconnect).not.toHaveBeenCalled();
    });

    it('extracts token from authorization header', async () => {
      mockClient.handshake.headers = {
        authorization: 'Bearer header-token',
      };
      jwtService.verify.mockReturnValue({ sub: 'user-2' });

      await gateway.handleConnection(mockClient);

      expect(jwtService.verify).toHaveBeenCalledWith('header-token', {
        secret: process.env.JWT_SECRET,
      });
      expect(mockClient.join).toHaveBeenCalledWith('user:user-2');
    });
  });

  describe('handleDisconnect', () => {
    it('logs disconnection', () => {
      const mockClient = { id: 'socket-1' };
      // Should not throw
      expect(() =>
        gateway.handleDisconnect(mockClient as any),
      ).not.toThrow();
    });
  });
});
