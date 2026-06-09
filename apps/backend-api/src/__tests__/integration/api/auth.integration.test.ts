/**
 * Integration Tests — Auth Flow
 *
 * Tests the complete authentication lifecycle against a real PostgreSQL database:
 *   POST /api/auth/register  →  Create account
 *   POST /api/auth/login     →  Authenticate
 *   GET  /api/users/me       →  Retrieve current user
 *
 * Uses jest-prisma-transformer.cjs to patch Prisma 7's `import.meta.url`.
 * Run with: npx jest --config jest.integration.config.cjs
 */

import request from 'supertest';
import {
  app,
  cleanDatabase,
  disconnectDatabase,
  registerUser,
  loginUser,
  uniqueEmail,
  authHeader,
  STRONG_PASSWORD,
} from '../helpers';

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  // ─── POST /api/auth/register ──────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('should register a new user and return token', async () => {
      const email = uniqueEmail('register');
      const res = await request(app).post('/api/auth/register').send({
        email,
        password: STRONG_PASSWORD,
        firstName: 'John',
        lastName: 'Doe',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user).toMatchObject({
        email,
        firstName: 'John',
        lastName: 'Doe',
      });
      // password should NOT be in response
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('should reject duplicate email', async () => {
      const email = uniqueEmail('dup');

      // Register first time
      await request(app).post('/api/auth/register').send({
        email,
        password: STRONG_PASSWORD,
        firstName: 'A',
        lastName: 'B',
      });

      // Register again with same email
      const res = await request(app).post('/api/auth/register').send({
        email,
        password: STRONG_PASSWORD,
        firstName: 'C',
        lastName: 'D',
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(res.body.success).toBe(false);
    });

    it('should enforce password strength requirements', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail('weakpw'),
          password: 'weak', // too short, no uppercase, no number
          firstName: 'Test',
          lastName: 'Weak',
        });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should require email, password, firstName, lastName', async () => {
      const res = await request(app).post('/api/auth/register').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'not-an-email',
        password: STRONG_PASSWORD,
        firstName: 'Test',
        lastName: 'BadEmail',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should accept optional gender field', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail('gender'),
          password: STRONG_PASSWORD,
          firstName: 'Jane',
          lastName: 'Doe',
          gender: 'FEMALE',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('should ignore role=ADMIN and always create CAREGIVER via public register', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: uniqueEmail('admin-attempt'),
          password: STRONG_PASSWORD,
          firstName: 'Admin',
          lastName: 'Attempt',
          role: 'ADMIN',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('CAREGIVER');
    });
  });

  // ─── POST /api/auth/login ─────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    let registeredEmail: string;

    beforeAll(async () => {
      // Create a user to login with
      const { data } = await registerUser();
      registeredEmail = data.email;
    });

    it('should login with valid credentials', async () => {
      const { res, token, user } = await loginUser(registeredEmail, STRONG_PASSWORD);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(token).toBeDefined();
      expect(user).toMatchObject({ email: registeredEmail });
    });

    it('should support login with "identifier" field (instead of "email")', async () => {
      const res = await request(app).post('/api/auth/login').send({
        identifier: registeredEmail,
        password: STRONG_PASSWORD,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: registeredEmail,
        password: 'WrongPassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@example.com',
        password: STRONG_PASSWORD,
      });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject empty body', async () => {
      const res = await request(app).post('/api/auth/login').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  // ─── GET /api/users/me ────────────────────────────────────────────────────

  describe('GET /api/users/me', () => {
    let validToken: string;
    let registeredEmail: string;

    beforeAll(async () => {
      const { data, token } = await registerUser();
      if (!token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }
      validToken = token;
      registeredEmail = data.email;
    });

    it('should return current user with valid token', async () => {
      const res = await request(app).get('/api/users/me').set(authHeader(validToken));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({ email: registeredEmail });
      // Sensitive fields excluded
      expect(res.body.data.password).toBeUndefined();
    });

    it('should reject request without token', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject invalid token', async () => {
      const res = await request(app).get('/api/users/me').set(authHeader('invalid.jwt.token'));

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', 'NotBearer something');

      expect(res.status).toBe(401);
    });
  });
});
