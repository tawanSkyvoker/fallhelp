/**
 * Integration Tests — User Profile & Account
 *
 * Tests user management through the API:
 *   GET   /api/users/me            →  Get own profile
 *   PATCH /api/users/me            →  Update profile
 *   PUT   /api/users/me/password   →  Change password
 */

import request from 'supertest';
import {
  app,
  cleanDatabase,
  disconnectDatabase,
  registerUser,
  loginUser,
  authHeader,
  STRONG_PASSWORD,
  uniqueEmail,
} from '../helpers';

const requireToken = (token: string | undefined): string => {
  if (!token) {
    throw new Error('Expected registerUser() to return token in integration test');
  }
  return token;
};

describe('User Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  // ─── GET /api/users/me ────────────────────────────────────────────────────

  describe('GET /api/users/me', () => {
    it('should return the authenticated user profile', async () => {
      const { data, token } = await registerUser({ firstName: 'Profile', lastName: 'Test' });

      const res = await request(app)
        .get('/api/users/me')
        .set(authHeader(requireToken(token)));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        email: data.email,
        firstName: 'Profile',
        lastName: 'Test',
      });
      expect(res.body.data.password).toBeUndefined();
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app).get('/api/users/me');

      expect(res.status).toBe(401);
    });
  });

  // ─── PATCH /api/users/me ──────────────────────────────────────────────────

  describe('PATCH /api/users/me', () => {
    it('should update user firstName and lastName', async () => {
      const { token } = await registerUser();

      const res = await request(app)
        .patch('/api/users/me')
        .set(authHeader(requireToken(token)))
        .send({ firstName: 'Updated', lastName: 'Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        firstName: 'Updated',
        lastName: 'Name',
      });
    });

    it('should update phone number', async () => {
      const { token } = await registerUser();

      const res = await request(app)
        .patch('/api/users/me')
        .set(authHeader(requireToken(token)))
        .send({ phone: '0812345678' });

      expect(res.status).toBe(200);
      expect(res.body.data.phone).toBe('0812345678');
    });

    it('should update email address', async () => {
      const { token } = await registerUser();
      const newEmail = uniqueEmail('updated');

      const res = await request(app)
        .patch('/api/users/me')
        .set(authHeader(requireToken(token)))
        .send({ email: newEmail });

      expect(res.status).toBe(200);
      expect(res.body.data.email).toBe(newEmail);
    });

    it('should reject duplicate email update', async () => {
      const firstUser = await registerUser();
      const secondUser = await registerUser();

      const res = await request(app)
        .patch('/api/users/me')
        .set(authHeader(requireToken(firstUser.token)))
        .send({ email: secondUser.data.email });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('duplicate_entry');
    });

    it('should persist profile updates across requests', async () => {
      const { token } = await registerUser();

      // Update profile
      await request(app)
        .patch('/api/users/me')
        .set(authHeader(requireToken(token)))
        .send({ firstName: 'Persistent' });

      // Verify persisted
      const res = await request(app)
        .get('/api/users/me')
        .set(authHeader(requireToken(token)));

      expect(res.body.data.firstName).toBe('Persistent');
    });
  });

  // ─── PUT /api/users/me/password ───────────────────────────────────────────

  describe('PUT /api/users/me/password', () => {
    it('should change password and allow login with new password', async () => {
      const { data, token } = await registerUser();
      const newPassword = 'NewPass456';

      // Change password
      const res = await request(app)
        .put('/api/users/me/password')
        .set(authHeader(requireToken(token)))
        .send({ currentPassword: STRONG_PASSWORD, newPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Login with new password should work
      const loginRes = await loginUser(data.email, newPassword);
      expect(loginRes.res.status).toBe(200);
    });

    it('should reject wrong current password', async () => {
      const { token } = await registerUser();

      const res = await request(app)
        .put('/api/users/me/password')
        .set(authHeader(requireToken(token)))
        .send({ currentPassword: 'WrongOldPass1', newPassword: 'NewPass456' });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject weak new password', async () => {
      const { token } = await registerUser();

      const res = await request(app)
        .put('/api/users/me/password')
        .set(authHeader(requireToken(token)))
        .send({ currentPassword: STRONG_PASSWORD, newPassword: 'weak' });

      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body.success).toBe(false);
    });
  });
});
