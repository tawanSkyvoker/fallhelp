/**
 * Integration Tests — Notification Routes
 *
 * GET    /api/notifications             → list notifications (paginated)
 * GET    /api/notifications/unread-count → count unread
 * PATCH  /api/notifications/:id        → mark single notification as read
 * PATCH  /api/notifications            → mark all as read
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

// ─── Seed Helper ──────────────────────────────────────────────────────────────

async function seedNotification(userId: string, overrides: Record<string, unknown> = {}) {
  const suffix = `${Date.now()}${Math.random().toString(16).slice(2, 8)}`.toUpperCase();
  const serialSuffix = suffix
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12)
    .padEnd(12, '0');

  const existingElder = await prisma.elder.findUnique({
    where: { userId },
    include: { device: true },
  });

  const elder =
    existingElder ??
    (await prisma.elder.create({
      data: {
        firstName: 'Notification',
        lastName: 'Receiver',
        userId,
        diseases: null,
      },
      include: { device: true },
    }));

  const device =
    elder.device ??
    (await prisma.device.create({
      data: {
        deviceCode: `TEST-${suffix}`.slice(0, 32),
        serialNumber: `ESP32-${serialSuffix}`,
        elderId: elder.id,
        status: 'PAIRED',
      },
    }));

  const event = await prisma.event.create({
    data: {
      elderId: elder.id,
      deviceId: device.id,
      fallStage: 'CONFIRMED',
    },
  });

  return prisma.notification.create({
    data: {
      userId,
      eventId: event.id,
      title: 'Fall detected',
      message: 'Test notification',
      isRead: false,
      ...overrides,
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Notification Integration Tests', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  // ─── GET /api/notifications ───────────────────────────────────────────────

  describe('GET /api/notifications', () => {
    let token: string;
    let userId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Notif', lastName: 'List' });
      if (!reg.token) throw new Error('expected token');
      token = reg.token;
      if (!reg.user) throw new Error('expected user');
      userId = reg.user['id'] as string;

      await seedNotification(userId);
      await seedNotification(userId, { title: 'Fall 2' });
    });

    it('should return list of user notifications', async () => {
      const res = await request(app).get('/api/notifications').set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    it('should support pagination params', async () => {
      const res = await request(app)
        .get('/api/notifications?page=1&pageSize=1')
        .set(authHeader(token));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(1);
    });

    it("should not return other user's notifications", async () => {
      const other = await registerUser({ firstName: 'Other', lastName: 'Notif' });
      if (!other.token) throw new Error('expected token');
      const res = await request(app).get('/api/notifications').set(authHeader(other.token));

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(0);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/notifications/unread-count ─────────────────────────────────

  describe('GET /api/notifications/unread-count', () => {
    let token: string;
    let userId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Notif', lastName: 'Count' });
      if (!reg.token) throw new Error('expected token');
      if (!reg.user) throw new Error('expected user');
      token = reg.token;
      userId = reg.user['id'] as string;

      await seedNotification(userId, { isRead: false });
      await seedNotification(userId, { isRead: false });
      await seedNotification(userId, { isRead: true });
    });

    it('should return correct unread count', async () => {
      const res = await request(app).get('/api/notifications/unread-count').set(authHeader(token));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(2);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).get('/api/notifications/unread-count');
      expect(res.status).toBe(401);
    });
  });

  // ─── PATCH /api/notifications/:id ────────────────────────────────────────

  describe('PATCH /api/notifications/:id', () => {
    let token: string;
    let userId: string;
    let notifId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Notif', lastName: 'MarkOne' });
      if (!reg.token) throw new Error('expected token');
      if (!reg.user) throw new Error('expected user');
      token = reg.token;
      userId = reg.user['id'] as string;

      const notif = await seedNotification(userId, { isRead: false });
      notifId = notif.id;
    });

    it('should mark a notification as read', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${notifId}`)
        .set(authHeader(token))
        .send({ isRead: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should reject invalid isRead value', async () => {
      const res = await request(app)
        .patch(`/api/notifications/${notifId}`)
        .set(authHeader(token))
        .send({ isRead: 'yes' });

      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).patch(`/api/notifications/${notifId}`).send({ isRead: true });

      expect(res.status).toBe(401);
    });
  });

  // ─── PATCH /api/notifications (mark all read) ─────────────────────────────

  describe('PATCH /api/notifications (mark all read)', () => {
    let token: string;
    let userId: string;

    beforeAll(async () => {
      await cleanDatabase();
      const reg = await registerUser({ firstName: 'Notif', lastName: 'MarkAll' });
      if (!reg.token) throw new Error('expected token');
      if (!reg.user) throw new Error('expected user');
      token = reg.token;
      userId = reg.user['id'] as string;

      await seedNotification(userId, { isRead: false });
      await seedNotification(userId, { isRead: false });
    });

    it('should mark all notifications as read', async () => {
      const res = await request(app)
        .patch('/api/notifications')
        .set(authHeader(token))
        .send({ action: 'mark_all_read' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify count is now 0
      const countRes = await request(app)
        .get('/api/notifications/unread-count')
        .set(authHeader(token));
      expect(countRes.body.data.count).toBe(0);
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app).patch('/api/notifications').send({ action: 'mark_all_read' });

      expect(res.status).toBe(401);
    });
  });
});
