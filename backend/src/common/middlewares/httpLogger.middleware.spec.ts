import { Logger } from '@nestjs/common';
import { HttpLogger } from './httpLogger.middleware';

describe('HttpLogger', () => {
  let middleware: HttpLogger;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    middleware = new HttpLogger();
    mockNext = jest.fn();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('logs request details on response finish', () => {
      mockRequest = {
        ip: '192.168.1.1',
        method: 'GET',
        originalUrl: '/api/users',
        get: jest.fn().mockReturnValue('Chrome/120'),
      };

      mockResponse = {
        get: jest.fn().mockReturnValue('1234'),
        statusCode: 200,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        }),
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();

      const loggedMessage = logSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('GET');
      expect(loggedMessage).toContain('/api/users');
      expect(loggedMessage).toContain('200');
      expect(loggedMessage).toContain('1234');
      expect(loggedMessage).toContain('Chrome/120');
      expect(loggedMessage).toContain('192.168.1.1');
    });

    it('logs with empty user-agent when not provided', () => {
      mockRequest = {
        ip: '10.0.0.1',
        method: 'POST',
        originalUrl: '/api/auth/login',
        get: jest.fn().mockReturnValue(''),
      };

      mockResponse = {
        get: jest.fn().mockReturnValue(undefined),
        statusCode: 201,
        on: jest.fn((event, callback) => {
          if (event === 'finish') {
            callback();
          }
        }),
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      const loggedMessage = logSpy.mock.calls[0][0];
      expect(loggedMessage).toContain('POST /api/auth/login 201');
      expect(loggedMessage).toContain('10.0.0.1');
    });

    it('calls next before response finishes', () => {
      mockRequest = {
        ip: '127.0.0.1',
        method: 'GET',
        originalUrl: '/',
        get: jest.fn().mockReturnValue(''),
      };

      mockResponse = {
        get: jest.fn(),
        statusCode: 200,
        on: jest.fn(),
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('calculates response time in milliseconds', () => {
      mockRequest = {
        ip: '127.0.0.1',
        method: 'GET',
        originalUrl: '/',
        get: jest.fn().mockReturnValue(''),
      };

      mockResponse = {
        get: jest.fn(),
        statusCode: 200,
        on: jest.fn((event, callback) => callback()),
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      const loggedMessage = logSpy.mock.calls[0][0];
      expect(loggedMessage).toMatch(/ms/);
    });
  });
});
