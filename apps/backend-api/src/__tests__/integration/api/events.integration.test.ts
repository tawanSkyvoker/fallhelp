/**
 * Integration Tests — Event History API
 *
 * Verifies that event endpoints expose the lean event contract:
 *   GET /api/events
 *   GET /api/events/:id
 */

import crypto from 'node:crypto';
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

const uniqueDevice = () => {
  deviceCounter += 1;
  return {
    deviceCode: `EVT-${Date.now()}-${deviceCounter}`,
    serialNumber: `SN-EVT-${Date.now()}-${deviceCounter}`,
  };
};

const insertEventRow = async (params: {
  id: string;
  elderId: string;
  deviceId: string;
  fallStage: string;
  bpm: number | null;
  magnitude?: number | null;
  postureDelta?: number | null;
  cancelledAt: Date | null;
  timestamp: Date;
}) => {
  await prisma.$executeRaw`
    INSERT INTO "events" (
      "id",
      "elderId",
      "deviceId",
      "fallStage",
      "bpm",
      "magnitude",
      "postureDelta",
      "cancelledAt",
      "timestamp"
    )
    VALUES (
      ${params.id},
      ${params.elderId},
      ${params.deviceId},
      ${params.fallStage},
      ${params.bpm},
      ${params.magnitude ?? null},
      ${params.postureDelta ?? null},
      ${params.cancelledAt},
      ${params.timestamp}
    )
  `;
};

describe('Event Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('GET /api/events', () => {
    it('should return events with bpm and cancelledAt fields', async () => {
      await cleanDatabase();

      const { token } = await registerUser({ firstName: 'Owner', lastName: 'EventsList' });
      if (!token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }

      const elderRes = await request(app)
        .post('/api/elders')
        .set(authHeader(token))
        .send({ firstName: 'Grandma', lastName: 'History' });

      expect(elderRes.status).toBe(201);
      const elderId = elderRes.body.data.id as string;

      const device = await prisma.device.create({
        data: {
          ...uniqueDevice(),
          elderId,
          status: 'PAIRED',
        },
      });

      const cancelledAt = new Date('2026-03-28T13:15:12.000Z');
      const eventId = crypto.randomUUID();
      await insertEventRow({
        id: eventId,
        elderId,
        deviceId: device.id,
        fallStage: 'CANCELLED',
        bpm: 78,
        magnitude: 9.95,
        postureDelta: 45.2,
        cancelledAt,
        timestamp: new Date('2026-03-28T13:15:00.000Z'),
      });

      const res = await request(app).get('/api/events').query({ elderId }).set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0]).toMatchObject({
        id: eventId,
        elderId,
        deviceId: device.id,
        fallStage: 'CANCELLED',
        bpm: 78,
        magnitude: 9.95,
        postureDelta: 45.2,
        cancelledAt: cancelledAt.toISOString(),
      });
      expect(res.body.data[0].value).toBeUndefined();
      expect(res.body.data[0].isCancelled).toBeUndefined();
    });
  });

  describe('GET /api/events/:id', () => {
    it('should return a single event with bpm and cancelledAt fields', async () => {
      await cleanDatabase();

      const { token } = await registerUser({ firstName: 'Owner', lastName: 'EventsDetail' });
      if (!token) {
        throw new Error('Expected registerUser() to return token in integration test');
      }

      const elderRes = await request(app)
        .post('/api/elders')
        .set(authHeader(token))
        .send({ firstName: 'Grandpa', lastName: 'Detail' });

      expect(elderRes.status).toBe(201);
      const elderId = elderRes.body.data.id as string;

      const device = await prisma.device.create({
        data: {
          ...uniqueDevice(),
          elderId,
          status: 'PAIRED',
        },
      });

      const timestamp = new Date('2026-03-28T14:00:00.000Z');
      const eventId = crypto.randomUUID();
      await insertEventRow({
        id: eventId,
        elderId,
        deviceId: device.id,
        fallStage: 'CONFIRMED',
        bpm: 82,
        magnitude: 11.2,
        postureDelta: 63.4,
        cancelledAt: null,
        timestamp,
      });

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .query({ timestamp: timestamp.toISOString() })
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        id: eventId,
        elderId,
        deviceId: device.id,
        fallStage: 'CONFIRMED',
        bpm: 82,
        magnitude: 11.2,
        postureDelta: 63.4,
        cancelledAt: null,
      });
      expect(res.body.data.value).toBeUndefined();
      expect(res.body.data.isCancelled).toBeUndefined();
    });
  });
});
