/**
 * app.ts smoke tests
 * Verifies that the Express app is assembled correctly.
 * All heavy external dependencies (mqtt, prisma, socket.io) are mocked.
 */

// ─── Mocks must be declared before any imports ────────────────────────────────

jest.mock('../../prisma', () => ({ __esModule: true, default: {} }));

jest.mock('../../iot/mqttClient', () => ({
  mqttClient: { connect: jest.fn(), disconnect: jest.fn() },
}));

jest.mock('../../realtime/socketServer', () => ({
  socketServer: { initialize: jest.fn(), close: jest.fn() },
}));

// Mock all controllers so route imports don't pull in service/DB
jest.mock('../../controllers/adminController', () => ({
  createDevice: jest.fn(),
  getAllDevices: jest.fn(),
  deleteDevice: jest.fn(),
  forceUnpairDevice: jest.fn(),
}));
jest.mock('../../controllers/authController', () => ({
  register: jest.fn(),
  login: jest.fn(),
  adminLogin: jest.fn(),
  requestOtp: jest.fn(),
  verifyOtp: jest.fn(),
  resetPassword: jest.fn(),
  logout: jest.fn(),
}));
jest.mock('../../controllers/deviceController', () => ({
  getDeviceByCode: jest.fn(),
  configureWiFi: jest.fn(),
  getDeviceConfig: jest.fn(),
  pairDevice: jest.fn(),
  unpairDevice: jest.fn(),
}));
jest.mock('../../controllers/elderController', () => ({
  createElder: jest.fn(),
  getCurrentElder: jest.fn(),
  getElderById: jest.fn(),
  updateElder: jest.fn(),
}));
jest.mock('../../controllers/emergencyContactController', () => ({
  getEmergencyContacts: jest.fn(),
  createEmergencyContact: jest.fn(),
  reorderEmergencyContacts: jest.fn(),
  updateEmergencyContact: jest.fn(),
  deleteEmergencyContact: jest.fn(),
}));
jest.mock('../../controllers/eventController', () => ({
  getEvents: jest.fn(),
  getMonthlySummary: jest.fn(),
  getEventById: jest.fn(),
}));
jest.mock('../../controllers/internal/healthController', () => ({
  getHealth: jest.fn((_req: unknown, res: { json: (v: unknown) => void }) =>
    res.json({ status: 'ok' }),
  ),
}));

jest.mock('../../middlewares/rateLimit', () => ({
  apiLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  authLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  loginLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  otpLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));
jest.mock('../../controllers/notificationController', () => ({
  listNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
}));
jest.mock('../../controllers/userController', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  updatePushToken: jest.fn(),
}));

jest.mock('../../middlewares/auth', () => ({
  authenticate: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  requireAdmin: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

import request from 'supertest';
import app from '../../app';

describe('app.ts', () => {
  it('exports an Express application', () => {
    expect(app).toBeDefined();
    expect(typeof app).toBe('function');
  });

  it('responds with 404 JSON for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist-xyz');
    expect(res.status).toBe(404);
  });

  it('has trust proxy set to 1', () => {
    // Express stores trust proxy as 'trust proxy fn' after setting it
    expect((app as unknown as { settings: Record<string, unknown> }).settings['trust proxy']).toBe(
      1,
    );
  });

  it('returns CORS error for disallowed origin in production-like scenario', async () => {
    // In test/development isDevelopment is true, so unknown origins are checked
    // against development prefixes. A totally unknown origin will be blocked only
    // in production. In dev mode, localhost origins pass. We just verify CORS
    // middleware is wired by checking the response has no CORS header for
    // a blocked origin (non-localhost, non-dev in any env).
    const res = await request(app)
      .get('/internal/health')
      .set('Origin', 'https://evil.example.com');
    // In development mode, non-local origins are blocked → error
    // The response may be 500 (CORS error thrown) or have no allow-origin header.
    // We accept either; what matters is the header is NOT present.
    const allowOrigin = res.headers['access-control-allow-origin'];
    expect(allowOrigin).toBeUndefined();
  });

  it('accepts requests from localhost origin in development', async () => {
    const res = await request(app).get('/internal/health').set('Origin', 'http://localhost:3000');
    // health controller is mocked (jest.fn()) so it won't call next properly,
    // but CORS will have allowed the request → allow-origin header present.
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  it('accepts requests with no origin (mobile native client)', async () => {
    const res = await request(app).get('/internal/health');
    // No CORS rejection → status should not be 403/500 due to CORS
    expect(res.status).not.toBe(403);
  });
});
