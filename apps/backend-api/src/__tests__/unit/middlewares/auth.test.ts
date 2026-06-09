/**
 * Auth Middleware Tests
 * Tests: authenticate, requireAdmin
 */

// Mock JWT
const mockVerifyToken = jest.fn();
jest.mock('../../../utils/jwt', () => ({
  verifyToken: (token: unknown) => mockVerifyToken(token),
}));

// Mock Prisma
const mockUserFindUnique = jest.fn();
jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: mockUserFindUnique,
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

import { Request, Response, NextFunction } from 'express';
import { authenticate, requireAdmin } from '../../../middlewares/auth';

// ==========================================
// Helpers
// ==========================================
const createMockReq = (overrides: Record<string, unknown> = {}) => {
  return {
    headers: {},
    path: '/api/test',
    ...overrides,
  } as unknown as Request;
};

const createMockRes = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
};

const nextFn = jest.fn() as NextFunction;

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // authenticate
  // ==========================================
  describe('authenticate', () => {
    it('should set req.user and call next() for valid token', async () => {
      const decoded = { userId: 'user-001', email: 'test@test.com', role: 'CAREGIVER' };
      mockVerifyToken.mockReturnValue(decoded);
      mockUserFindUnique.mockResolvedValue({ id: 'user-001' });

      const req = createMockReq({
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = createMockRes();

      await authenticate(req, res, nextFn);

      expect(req.user).toEqual(decoded);
      expect(nextFn).toHaveBeenCalled();
    });

    it('should return 401 if no authorization header', async () => {
      const req = createMockReq();
      const res = createMockRes();

      await authenticate(req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'missing_token',
          }),
        }),
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 if no Bearer prefix', async () => {
      const req = createMockReq({
        headers: { authorization: 'Basic token' },
      });
      const res = createMockRes();

      await authenticate(req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 if user not found in DB', async () => {
      mockVerifyToken.mockReturnValue({ userId: 'user-001' });
      mockUserFindUnique.mockResolvedValue(null);

      const req = createMockReq({
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = createMockRes();

      await authenticate(req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 if token is invalid', async () => {
      mockVerifyToken.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const req = createMockReq({
        headers: { authorization: 'Bearer invalid-token' },
      });
      const res = createMockRes();

      await authenticate(req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'invalid_token',
          }),
        }),
      );
    });
  });

  // ==========================================
  // requireAdmin
  // ==========================================
  describe('requireAdmin', () => {
    it('should call next() for admin user', () => {
      const req = createMockReq({
        user: { userId: 'admin-001', role: 'ADMIN' },
      });
      const res = createMockRes();

      requireAdmin(req, res, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });

    it('should return 401 if no user', () => {
      const req = createMockReq();
      const res = createMockRes();

      requireAdmin(req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 403 for non-admin user', () => {
      const req = createMockReq({
        user: { userId: 'user-001', role: 'CAREGIVER' },
      });
      const res = createMockRes();

      requireAdmin(req, res, nextFn);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('should allow admin user without any sub-role', () => {
      const req = createMockReq({
        user: { userId: 'admin-001', role: 'ADMIN' },
      });
      const res = createMockRes();

      requireAdmin(req, res, nextFn);

      expect(nextFn).toHaveBeenCalled();
    });
  });
});
