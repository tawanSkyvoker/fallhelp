/**
 * Error Handler Middleware Tests
 * Tests: ApiError, Prisma errors (P2002, P2025, P2003), JWT errors, 404 handler
 */

import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../../utils/ApiError';

// Mock Prisma client
jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      meta: Record<string, unknown> | undefined;
      constructor(
        message: string,
        opts: { code: string; meta?: Record<string, unknown>; clientVersion: string },
      ) {
        super(message);
        this.code = opts.code;
        this.meta = opts.meta;
        this.name = 'PrismaClientKnownRequestError';
      }
    },
    PrismaClientValidationError: class PrismaClientValidationError extends Error {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(message: string, _opts?: { clientVersion?: string }) {
        super(message);
        this.name = 'PrismaClientValidationError';
      }
    },
  },
}));

// Mock debug
jest.mock('debug', () => {
  const dummyFn = () => {};
  return {
    __esModule: true,
    default: () => dummyFn,
  };
});

import { errorHandler, notFoundHandler } from '../../../middlewares/errorHandler';
import { Prisma } from '../../../generated/prisma/client';

// ==========================================
// Helpers
// ==========================================
const createMockRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

const createMockReq = (overrides = {}) => {
  return {
    method: 'GET',
    path: '/api/test',
    ...overrides,
  } as unknown as Request;
};

const nextFn = jest.fn() as NextFunction;

describe('Error Handler Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // ApiError handling
  // ==========================================
  describe('ApiError', () => {
    it('should return correct status and Thai message', () => {
      const error = new ApiError('user_not_found');
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'user_not_found',
          message: expect.any(String), // Thai message
        },
      });
    });

    it('should use custom message if provided', () => {
      const error = new ApiError('validation_error', 'custom message');
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'validation_error',
          message: 'custom message',
        },
      });
    });
  });

  // ==========================================
  // Prisma P2002 — Unique constraint violation
  // ==========================================
  describe('Prisma P2002 (Unique constraint)', () => {
    it('should detect email field', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        meta: { target: ['email'] },
        clientVersion: '5.0.0',
      });
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'email_already_exists',
          }),
        }),
      );
    });

    it('should detect phone field', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        meta: { target: ['phone'] },
        clientVersion: '5.0.0',
      });
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'phone_already_exists',
          }),
        }),
      );
    });

    it('should detect serialNumber field', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        meta: { target: ['serialNumber'] },
        clientVersion: '5.0.0',
      });
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'serial_number_exists',
          }),
        }),
      );
    });

    it('should detect field from driverAdapterError when target is not direct', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        meta: {
          driverAdapterError: {
            cause: {
              constraint: {
                fields: ['"serialNumber"']
              }
            }
          }
        },
        clientVersion: '5.0.0',
      });
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'serial_number_exists',
            message: 'หมายเลขซีเรียลนี้ถูกใช้งานแล้ว',
          }),
        }),
      );
    });

    it('should handle unknown field with generic message', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        meta: { target: ['unknownField'] },
        clientVersion: '5.0.0',
      });
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'duplicate_entry',
          }),
        }),
      );
    });
  });

  // ==========================================
  // Prisma P2025 — Record not found
  // ==========================================
  describe('Prisma P2025 (Record not found)', () => {
    it('should return 404', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: '5.0.0',
      });
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'resource_not_found',
          }),
        }),
      );
    });
  });

  // ==========================================
  // Prisma P2003 — Foreign key constraint
  // ==========================================
  describe('Prisma P2003 (Foreign key)', () => {
    it('should return 400', () => {
      const error = new Prisma.PrismaClientKnownRequestError('FK constraint', {
        code: 'P2003',
        clientVersion: '5.0.0',
      });
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'validation_error',
          }),
        }),
      );
    });
  });

  // ==========================================
  // JWT errors
  // ==========================================
  describe('JWT errors', () => {
    it('should handle JsonWebTokenError', () => {
      const error = new Error('jwt malformed');
      error.name = 'JsonWebTokenError';
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'invalid_token',
          }),
        }),
      );
    });

    it('should handle TokenExpiredError', () => {
      const error = new Error('jwt expired');
      error.name = 'TokenExpiredError';
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'session_expired',
          }),
        }),
      );
    });
  });

  // ==========================================
  // Default (unknown) error
  // ==========================================
  describe('Unknown errors', () => {
    it('should return 500 with generic message', () => {
      const error = new Error('Something unexpected');
      const res = createMockRes();

      errorHandler(error, createMockReq(), res, nextFn);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'internal_server_error',
          message: expect.any(String),
        },
      });
    });
  });

  // ==========================================
  // 404 Not Found Handler
  // ==========================================
  describe('notFoundHandler', () => {
    it('should return 404 with method and path', () => {
      const req = createMockReq({ method: 'POST', path: '/api/unknown' });
      const res = createMockRes();

      notFoundHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Cannot POST /api/unknown',
      });
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// PrismaClientValidationError — lines 105-112
// ──────────────────────────────────────────────────────────────────────────
describe('PrismaClientValidationError', () => {
  it('should return 400 with validation_error code', () => {
    const error = new Prisma.PrismaClientValidationError('Invalid query shape', {
      clientVersion: '5.0.0',
    });
    const res = createMockRes();

    errorHandler(error, createMockReq(), res, nextFn);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'validation_error' }),
      }),
    );
  });
});
