/**
 * Integration Tests — Emergency Contact Routes
 *
 * All endpoints are nested under /api/elders/:elderId/emergency-contacts
 *
 * GET    /api/elders/:elderId/emergency-contacts           → list contacts
 * POST   /api/elders/:elderId/emergency-contacts           → create contact
 * PATCH  /api/elders/:elderId/emergency-contacts/order     → reorder contacts
 * PATCH  /api/elders/:elderId/emergency-contacts/:id       → update contact
 * DELETE /api/elders/:elderId/emergency-contacts/:id       → delete contact
 */

import request from 'supertest';
import { app, cleanDatabase, disconnectDatabase, registerUser, authHeader } from '../helpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createTestElder(token: string) {
  const res = await request(app)
    .post('/api/elders')
    .set(authHeader(token))
    .send({ firstName: 'Contact', lastName: 'Elder' });
  if (res.status !== 201) throw new Error(`createTestElder failed: ${res.status}`);
  return res.body.data as { id: string };
}

const BASE_CONTACT = { name: 'Jane Doe', phone: '0812345678', relationship: 'ลูก', priority: 1 };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Emergency Contact Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  // ─── POST ─────────────────────────────────────────────────────────────────

  describe('POST /api/elders/:elderId/emergency-contacts', () => {
    let token: string;
    let elderId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Create', lastName: 'Contact' });
      if (!reg.token) throw new Error('expected token');
      token = reg.token;
      const elder = await createTestElder(token);
      elderId = elder.id;
    });

    it('should create an emergency contact', async () => {
      const res = await request(app)
        .post(`/api/elders/${elderId}/emergency-contacts`)
        .set(authHeader(token))
        .send(BASE_CONTACT);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Jane Doe');
      expect(res.body.data.phone).toBe('0812345678');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app)
        .post(`/api/elders/${elderId}/emergency-contacts`)
        .send(BASE_CONTACT);

      expect(res.status).toBe(401);
    });

    it("should deny access to other user's elder", async () => {
      const other = await registerUser({ firstName: 'Other', lastName: 'User' });
      if (!other.token) throw new Error('expected token');
      const res = await request(app)
        .post(`/api/elders/${elderId}/emergency-contacts`)
        .set(authHeader(other.token))
        .send({ ...BASE_CONTACT, priority: 2 });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────────────

  describe('GET /api/elders/:elderId/emergency-contacts', () => {
    let token: string;
    let elderId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'List', lastName: 'Contact' });
      if (!reg.token) throw new Error('expected token');
      token = reg.token;
      const elder = await createTestElder(token);
      elderId = elder.id;

      // seed one contact
      await request(app)
        .post(`/api/elders/${elderId}/emergency-contacts`)
        .set(authHeader(token))
        .send(BASE_CONTACT);
    });

    it('should return list of emergency contacts', async () => {
      const res = await request(app)
        .get(`/api/elders/${elderId}/emergency-contacts`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get(`/api/elders/${elderId}/emergency-contacts`);
      expect(res.status).toBe(401);
    });
  });

  // ─── PATCH /:id ───────────────────────────────────────────────────────────

  describe('PATCH /api/elders/:elderId/emergency-contacts/:id', () => {
    let token: string;
    let elderId: string;
    let contactId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Update', lastName: 'Contact' });
      if (!reg.token) throw new Error('expected token');
      token = reg.token;
      const elder = await createTestElder(token);
      elderId = elder.id;

      const createRes = await request(app)
        .post(`/api/elders/${elderId}/emergency-contacts`)
        .set(authHeader(token))
        .send(BASE_CONTACT);
      contactId = createRes.body.data.id;
    });

    it('should update emergency contact fields', async () => {
      const res = await request(app)
        .patch(`/api/elders/${elderId}/emergency-contacts/${contactId}`)
        .set(authHeader(token))
        .send({ name: 'Updated Name', phone: '0899999999' });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('Updated Name');
      expect(res.body.data.phone).toBe('0899999999');
    });

    it('should return 404 for non-existent contact', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .patch(`/api/elders/${elderId}/emergency-contacts/${fakeId}`)
        .set(authHeader(token))
        .send({ name: 'Ghost' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  // ─── PATCH /order ─────────────────────────────────────────────────────────

  describe('PATCH /api/elders/:elderId/emergency-contacts/order', () => {
    let token: string;
    let elderId: string;
    let contactId1: string;
    let contactId2: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Reorder', lastName: 'Contact' });
      if (!reg.token) throw new Error('expected token');
      token = reg.token;
      const elder = await createTestElder(token);
      elderId = elder.id;

      const c1 = await request(app)
        .post(`/api/elders/${elderId}/emergency-contacts`)
        .set(authHeader(token))
        .send({ name: 'Contact A', phone: '0811111111', priority: 1 });
      contactId1 = c1.body.data.id;

      const c2 = await request(app)
        .post(`/api/elders/${elderId}/emergency-contacts`)
        .set(authHeader(token))
        .send({ name: 'Contact B', phone: '0822222222', priority: 2 });
      contactId2 = c2.body.data.id;
    });

    it('should reorder contacts', async () => {
      const res = await request(app)
        .patch(`/api/elders/${elderId}/emergency-contacts/order`)
        .set(authHeader(token))
        .send({ contactIds: [contactId2, contactId1] }); // swap order

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────────────

  describe('DELETE /api/elders/:elderId/emergency-contacts/:id', () => {
    let token: string;
    let elderId: string;
    let contactId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Delete', lastName: 'Contact' });
      if (!reg.token) throw new Error('expected token');
      token = reg.token;
      const elder = await createTestElder(token);
      elderId = elder.id;

      const createRes = await request(app)
        .post(`/api/elders/${elderId}/emergency-contacts`)
        .set(authHeader(token))
        .send(BASE_CONTACT);
      contactId = createRes.body.data.id;
    });

    it('should delete an emergency contact', async () => {
      const res = await request(app)
        .delete(`/api/elders/${elderId}/emergency-contacts/${contactId}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 when deleting again', async () => {
      const res = await request(app)
        .delete(`/api/elders/${elderId}/emergency-contacts/${contactId}`)
        .set(authHeader(token));

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).delete(
        `/api/elders/${elderId}/emergency-contacts/${contactId}`,
      );
      expect(res.status).toBe(401);
    });
  });
});
