/**
 * Integration Tests — devicePairingRoutes.ts
 *
 * POST   /api/device-pairings             → จับคู่อุปกรณ์กับ elder
 * DELETE /api/device-pairings/:deviceId   → ยกเลิกการจับคู่
 */

import request from 'supertest';
import {
  app,
  prisma,
  cleanDatabase,
  disconnectDatabase,
  registerUser,
  authHeader,
} from '../helpers';

let deviceCounter = 0;

async function createTestDevice() {
  const n = ++deviceCounter;
  return prisma.device.create({
    data: {
      deviceCode: `PAIR${n.toString().padStart(6, '0')}`,
      serialNumber: `SN-PAIR-${n.toString().padStart(6, '0')}`,
      status: 'UNPAIRED',
    },
  });
}

async function createTestElder(token: string) {
  const res = await request(app)
    .post('/api/elders')
    .set(authHeader(token))
    .send({ firstName: 'Test', lastName: 'Elder' });
  if (res.status !== 201) throw new Error(`createTestElder failed: ${res.status}`);
  return res.body.data as { id: string };
}

describe('devicePairingRoutes Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });
  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  // ─── POST /api/device-pairings ────────────────────────────────────────────

  describe('POST /api/device-pairings', () => {
    let token: string;
    let elderId: string;
    let deviceCode: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Pair', lastName: 'Owner' });
      if (!reg.token) throw new Error('expected token');
      token = reg.token;

      const elder = await createTestElder(token);
      elderId = elder.id;

      const device = await createTestDevice();
      deviceCode = device.deviceCode;
    });

    it('should pair device to elder', async () => {
      const res = await request(app)
        .post('/api/device-pairings')
        .set(authHeader(token))
        .send({ deviceCode, elderId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.elderId).toBe(elderId);
    });

    it('should reject pairing an already-paired device', async () => {
      const res = await request(app)
        .post('/api/device-pairings')
        .set(authHeader(token))
        .send({ deviceCode, elderId });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).post('/api/device-pairings').send({ deviceCode, elderId });

      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/device-pairings/:deviceId ────────────────────────────────

  describe('DELETE /api/device-pairings/:deviceId', () => {
    let token: string;
    let deviceId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Unpair', lastName: 'Owner' });
      if (!reg.token) throw new Error('expected token');
      token = reg.token;

      const elder = await createTestElder(token);
      const device = await createTestDevice();
      deviceId = device.id;

      await request(app)
        .post('/api/device-pairings')
        .set(authHeader(token))
        .send({ deviceCode: device.deviceCode, elderId: elder.id });
    });

    it('should unpair device from elder', async () => {
      const res = await request(app)
        .delete(`/api/device-pairings/${deviceId}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return error when device not found', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .delete(`/api/device-pairings/${fakeId}`)
        .set(authHeader(token));

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).delete(`/api/device-pairings/${deviceId}`);
      expect(res.status).toBe(401);
    });
  });
});
