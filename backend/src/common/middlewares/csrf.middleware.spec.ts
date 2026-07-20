import { CsrfMiddleware } from './csrf.middleware';

describe('CsrfMiddleware', () => {
  let middleware: CsrfMiddleware;
  let mockRequest: any;
  let mockResponse: any;
  let mockNext: jest.Mock;

  beforeEach(() => {
    middleware = new CsrfMiddleware();
    mockNext = jest.fn();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  describe('use', () => {
    it('sets csrf cookie when no csrf cookie exists', () => {
      mockRequest = {
        cookies: {},
      };
      mockResponse = {
        cookie: jest.fn(),
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'csrf',
        expect.any(String),
        {
          httpOnly: false,
          sameSite: 'lax',
          secure: false,
          path: '/',
        },
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('sets csrf cookie when cookies are undefined', () => {
      mockRequest = {
        cookies: undefined,
      };
      mockResponse = {
        cookie: jest.fn(),
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'csrf',
        expect.any(String),
        expect.any(Object),
      );
      expect(mockNext).toHaveBeenCalled();
    });

    it('does not set csrf cookie when one already exists', () => {
      mockRequest = {
        cookies: { csrf: 'existing-token' },
      };
      mockResponse = {
        cookie: jest.fn(),
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockResponse.cookie).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });

    it('generates a 64-character hex token (two UUIDs without dashes)', () => {
      mockRequest = {
        cookies: {},
      };
      mockResponse = {
        cookie: jest.fn(),
      };

      middleware.use(mockRequest, mockResponse, mockNext);

      const token = mockResponse.cookie.mock.calls[0][1];
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('sets secure flag in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      mockRequest = { cookies: {} };
      mockResponse = { cookie: jest.fn() };

      middleware.use(mockRequest, mockResponse, mockNext);

      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'csrf',
        expect.any(String),
        expect.objectContaining({ secure: true }),
      );

      process.env.NODE_ENV = originalEnv;
    });
  });
});
