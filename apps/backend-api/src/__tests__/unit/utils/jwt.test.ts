/**
 * JWT Utility Tests
 * Tests: token generation, verification, expiry, invalid tokens
 * JWT_SECRET is set in setup.ts
 */

import jwt from 'jsonwebtoken';
import { generateToken, verifyToken, type JwtPayload } from '../../../utils/jwt';
import { ApiError } from '../../../utils/ApiError';

const SAMPLE_PAYLOAD: JwtPayload = {
  userId: 'user-123',
  email: 'test@example.com',
  role: 'CAREGIVER',
};

describe('JWT utils', () => {
  describe('generateToken', () => {
    it('should return a non-empty string', () => {
      const token = generateToken(SAMPLE_PAYLOAD);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    });

    it('should return a valid JWT with 3 parts', () => {
      const token = generateToken(SAMPLE_PAYLOAD);
      const parts = token.split('.');
      expect(parts).toHaveLength(3);
    });

    it('should embed userId in the token payload', () => {
      const token = generateToken(SAMPLE_PAYLOAD);
      const decoded = jwt.decode(token) as JwtPayload;
      expect(decoded.userId).toBe(SAMPLE_PAYLOAD.userId);
    });

    it('should embed email in the token payload', () => {
      const token = generateToken(SAMPLE_PAYLOAD);
      const decoded = jwt.decode(token) as JwtPayload;
      expect(decoded.email).toBe(SAMPLE_PAYLOAD.email);
    });

    it('should embed role in the token payload', () => {
      const token = generateToken(SAMPLE_PAYLOAD);
      const decoded = jwt.decode(token) as JwtPayload;
      expect(decoded.role).toBe(SAMPLE_PAYLOAD.role);
    });

    it('should work with ADMIN role', () => {
      const adminPayload: JwtPayload = { ...SAMPLE_PAYLOAD, role: 'ADMIN' };
      const token = generateToken(adminPayload);
      const decoded = jwt.decode(token) as JwtPayload;
      expect(decoded.role).toBe('ADMIN');
    });
  });

  describe('verifyToken', () => {
    it('should return the original payload for a valid token', () => {
      const token = generateToken(SAMPLE_PAYLOAD);
      const decoded = verifyToken(token);
      expect(decoded.userId).toBe(SAMPLE_PAYLOAD.userId);
      expect(decoded.email).toBe(SAMPLE_PAYLOAD.email);
      expect(decoded.role).toBe(SAMPLE_PAYLOAD.role);
    });

    it('should throw ApiError for an invalid token string', () => {
      expect(() => verifyToken('not.a.valid.token')).toThrow(ApiError);
    });

    it('should throw ApiError with invalid_token code', () => {
      try {
        verifyToken('invalid.token.here');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe('invalid_token');
      }
    });

    it('should throw ApiError for an expired token', () => {
      const secret = process.env.JWT_SECRET as string;
      const expired = jwt.sign(SAMPLE_PAYLOAD, secret, { expiresIn: -1 });
      expect(() => verifyToken(expired)).toThrow(ApiError);
    });

    it('should throw ApiError for a tampered token', () => {
      const token = generateToken(SAMPLE_PAYLOAD);
      const parts = token.split('.');
      parts[1] = Buffer.from(
        JSON.stringify({ userId: 'hacker', email: 'x@x.com', role: 'ADMIN' }),
      ).toString('base64');
      const tampered = parts.join('.');
      expect(() => verifyToken(tampered)).toThrow(ApiError);
    });

    it('should throw ApiError for empty string', () => {
      expect(() => verifyToken('')).toThrow(ApiError);
    });

    it('should throw ApiError for token signed with wrong secret', () => {
      const wrongToken = jwt.sign(SAMPLE_PAYLOAD, 'wrong-secret');
      expect(() => verifyToken(wrongToken)).toThrow(ApiError);
    });
  });
});
