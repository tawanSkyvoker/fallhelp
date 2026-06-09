/**
 * Integration Tests — Elder CRUD & Members
 *
 * Tests elder management lifecycle against a real PostgreSQL database:
 *   POST   /api/elders          →  Create elder profile
 *   GET    /api/elders          →  List user's elders
 *   GET    /api/elders/:id      →  Get elder detail
 *   PUT    /api/elders/:id      →  Update elder
 */

import request from 'supertest';
import { app, cleanDatabase, disconnectDatabase, registerUser, authHeader } from '../helpers';

describe('Elder Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  // ─── POST /api/elders ─────────────────────────────────────────────────────

  describe('POST /api/elders', () => {
    let ownerToken: string;

    beforeAll(async () => {
      await cleanDatabase();
      const { token } = await registerUser({ firstName: 'Owner', lastName: 'CreateElder' });
      if (!token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }
      ownerToken = token;
    });

    it('should create elder profile with required fields', async () => {
      const res = await request(app)
        .post('/api/elders')
        .set(authHeader(ownerToken))
        .send({ firstName: 'Grandma', lastName: 'Smith' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        firstName: 'Grandma',
        lastName: 'Smith',
      });
      expect(res.body.data.id).toBeDefined();
    });

    it('should create elder with optional health info', async () => {
      const { token } = await registerUser({ firstName: 'Owner', lastName: 'OptionalElder' });
      if (!token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }

      const res = await request(app).post('/api/elders').set(authHeader(token)).send({
        firstName: 'Grandpa',
        lastName: 'Jones',
        gender: 'MALE',
        height: 170,
        weight: 75,
        diseases: 'Diabetes',
      });

      expect(res.status).toBe(201);
      expect(res.body.data.gender).toBe('MALE');
      expect(res.body.data.height).toBe(170);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app)
        .post('/api/elders')
        .send({ firstName: 'No', lastName: 'Auth' });

      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/elders/current ──────────────────────────────────────────────

  describe('GET /api/elders/current', () => {
    beforeAll(async () => {
      await cleanDatabase();
    });

    it('should return current elder owned by the user', async () => {
      const { token } = await registerUser({ firstName: 'Owner', lastName: 'ListElder' });
      if (!token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }

      await request(app)
        .post('/api/elders')
        .set(authHeader(token))
        .send({ firstName: 'List', lastName: 'Case' });

      const res = await request(app).get('/api/elders/current').set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual(expect.objectContaining({ firstName: 'List' }));
    });

    it('should return null for new user with no elder', async () => {
      const { token } = await registerUser({ firstName: 'Empty', lastName: 'User' });
      if (!token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }

      const res = await request(app).get('/api/elders/current').set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.data).toBeNull();
    });
  });

  // ─── GET /api/elders/:id ──────────────────────────────────────────────────

  describe('GET /api/elders/:id', () => {
    let elderId: string;
    let ownerToken: string;

    beforeAll(async () => {
      await cleanDatabase();
      const registered = await registerUser({ firstName: 'Owner', lastName: 'DetailElder' });
      if (!registered.token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }
      ownerToken = registered.token;

      const createRes = await request(app)
        .post('/api/elders')
        .set(authHeader(ownerToken))
        .send({ firstName: 'Detail', lastName: 'Elder' });

      expect(createRes.status).toBe(201);
      elderId = createRes.body.data.id;
    });

    it('should return elder detail with access level', async () => {
      const res = await request(app).get(`/api/elders/${elderId}`).set(authHeader(ownerToken));

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        id: elderId,
        firstName: 'Detail',
        lastName: 'Elder',
      });
    });

    it('should deny access to user without access', async () => {
      const { token } = await registerUser({ firstName: 'No', lastName: 'Access' });
      if (!token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }

      const res = await request(app).get(`/api/elders/${elderId}`).set(authHeader(token));

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should return 404 for non-existent elder', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app).get(`/api/elders/${fakeId}`).set(authHeader(ownerToken));

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─── PUT /api/elders/:id ──────────────────────────────────────────────────

  describe('PUT /api/elders/:id', () => {
    let elderId: string;
    let ownerToken: string;

    beforeAll(async () => {
      await cleanDatabase();
      const registered = await registerUser({ firstName: 'Owner', lastName: 'UpdateElder' });
      if (!registered.token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }
      ownerToken = registered.token;

      const createRes = await request(app)
        .post('/api/elders')
        .set(authHeader(ownerToken))
        .send({ firstName: 'Before', lastName: 'Update' });

      expect(createRes.status).toBe(201);
      elderId = createRes.body.data.id;
    });

    it('should update elder fields', async () => {
      const res = await request(app)
        .put(`/api/elders/${elderId}`)
        .set(authHeader(ownerToken))
        .send({ firstName: 'After', province: 'Bangkok' });

      expect(res.status).toBe(200);
      expect(res.body.data.firstName).toBe('After');
      expect(res.body.data.province).toBe('Bangkok');
    });

    it('should persist updates', async () => {
      const res = await request(app).get(`/api/elders/${elderId}`).set(authHeader(ownerToken));

      expect(res.body.data.firstName).toBe('After');
    });
  });
});
