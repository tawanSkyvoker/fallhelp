/**
 * Integration Tests — deviceRoutes.ts
 *
 * GET /api/devices/by-code/:deviceCode  → ดูข้อมูลอุปกรณ์จาก code (ใช้ใน pairing flow)
 * PUT /api/devices/:id/wifi-config      → ส่ง WiFi credentials ไปอุปกรณ์
 * GET /api/devices/:id/wifi-config      → ดูสถานะ config ล่าสุด
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
      deviceCode: `DEVR${n.toString().padStart(6, '0')}`,
      serialNumber: `SN-DEVR-${n.toString().padStart(6, '0')}`,
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

describe('deviceRoutes Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });
  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  // ─── GET /api/devices/by-code/:deviceCode ─────────────────────────────────

  describe('GET /api/devices/by-code/:deviceCode', () => {
    let token: string;
    let deviceCode: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'QR', lastName: 'Lookup' });
      if (!reg.token) throw new Error('expected token');
      token = reg.token;

      const device = await createTestDevice();
      deviceCode = device.deviceCode;
    });

    it('should return device info without qrCode payload', async () => {
      const res = await request(app)
        .get(`/api/devices/by-code/${deviceCode}`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.deviceCode).toBe(deviceCode);
      expect(res.body.data.qrCode).toBeUndefined();
    });

    it('should return 404 for non-existent device code', async () => {
      const res = await request(app)
        .get('/api/devices/by-code/DOESNOTEXIST')
        .set(authHeader(token));

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get(`/api/devices/by-code/${deviceCode}`);
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/devices/:id/wifi-config ─────────────────────────────────────

  describe('GET /api/devices/:id/wifi-config', () => {
    let token: string;
    let deviceId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'WiFi', lastName: 'Getter' });
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

    it('should return device config for paired device', async () => {
      const res = await request(app)
        .get(`/api/devices/${deviceId}/wifi-config`)
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get(`/api/devices/${deviceId}/wifi-config`);
      expect(res.status).toBe(401);
    });
  });
});
