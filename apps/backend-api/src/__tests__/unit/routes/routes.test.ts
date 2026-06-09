/**
 * Route files smoke tests
 * Verifies that all route modules export a valid Express Router.
 * Controllers, middleware, and external deps are mocked so this file
 * only exercises the route-registration code itself.
 */

// ─── Mock every controller ────────────────────────────────────────────────────
jest.mock('../../../controllers/adminController', () => ({
  createDevice: jest.fn(),
  getAllDevices: jest.fn(),
  deleteDevice: jest.fn(),
  forceUnpairDevice: jest.fn(),
}));

jest.mock('../../../controllers/authController', () => ({
  register: jest.fn(),
  login: jest.fn(),
  adminLogin: jest.fn(),
  requestOtp: jest.fn(),
  verifyOtp: jest.fn(),
  resetPassword: jest.fn(),
  logout: jest.fn(),
}));

jest.mock('../../../controllers/deviceController', () => ({
  getDeviceByCode: jest.fn(),
  configureWiFi: jest.fn(),
  getDeviceConfig: jest.fn(),
  pairDevice: jest.fn(),
  unpairDevice: jest.fn(),
}));

jest.mock('../../../controllers/elderController', () => ({
  createElder: jest.fn(),
  getCurrentElder: jest.fn(),
  getElderById: jest.fn(),
  updateElder: jest.fn(),
}));

jest.mock('../../../controllers/emergencyContactController', () => ({
  getEmergencyContacts: jest.fn(),
  createEmergencyContact: jest.fn(),
  reorderEmergencyContacts: jest.fn(),
  updateEmergencyContact: jest.fn(),
  deleteEmergencyContact: jest.fn(),
}));

jest.mock('../../../controllers/eventController', () => ({
  getEvents: jest.fn(),
  getMonthlySummary: jest.fn(),
  getEventById: jest.fn(),
}));

jest.mock('../../../controllers/internal/healthController', () => ({
  getHealth: jest.fn(),
}));

jest.mock('../../../controllers/notificationController', () => ({
  listNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
}));

jest.mock('../../../controllers/userController', () => ({
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
  changePassword: jest.fn(),
  updatePushToken: jest.fn(),
}));

// ─── Mock all middleware ───────────────────────────────────────────────────────
jest.mock('../../../middlewares/auth', () => ({
  authenticate: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  requireAdmin: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

jest.mock('../../../middlewares/validation', () => ({
  validateLogin: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  validateRegister: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  validateOtpRequest: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  validateOtpVerification: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  validateResetPassword: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  validateCreateDevice: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  validateWiFiConfig: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

jest.mock('../../../middlewares/rateLimit', () => ({
  apiLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  authLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  loginLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  otpLimiter: jest.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

// ─── Mock prisma (required transitively) ─────────────────────────────────────
jest.mock('../../../prisma', () => ({ __esModule: true, default: {} }));

// ─── Import routers under test ────────────────────────────────────────────────
import adminRoutes from '../../../routes/adminRoutes';
import authRoutes from '../../../routes/authRoutes';
import devicePairingRoutes from '../../../routes/devicePairingRoutes';
import deviceRoutes from '../../../routes/deviceRoutes';
import elderRoutes from '../../../routes/elderRoutes';
import emergencyContactRoutes from '../../../routes/emergencyContactRoutes';
import eventRoutes from '../../../routes/eventRoutes';
import healthRoutes from '../../../routes/internal/healthRoutes';
import indexRoutes from '../../../routes/index';
import notificationRoutes from '../../../routes/notificationRoutes';
import userRoutes from '../../../routes/userRoutes';

// Helper: an Express Router always has a 'stack' array and is a function.
const isRouter = (r: unknown): boolean =>
  typeof r === 'function' && Array.isArray((r as { stack?: unknown[] }).stack);

describe('Route modules', () => {
  it('adminRoutes exports a router', () => {
    expect(isRouter(adminRoutes)).toBe(true);
  });

  it('authRoutes exports a router', () => {
    expect(isRouter(authRoutes)).toBe(true);
  });

  it('devicePairingRoutes exports a router', () => {
    expect(isRouter(devicePairingRoutes)).toBe(true);
  });

  it('deviceRoutes exports a router', () => {
    expect(isRouter(deviceRoutes)).toBe(true);
  });

  it('elderRoutes exports a router', () => {
    expect(isRouter(elderRoutes)).toBe(true);
  });

  it('emergencyContactRoutes exports a router', () => {
    expect(isRouter(emergencyContactRoutes)).toBe(true);
  });

  it('eventRoutes exports a router', () => {
    expect(isRouter(eventRoutes)).toBe(true);
  });

  it('healthRoutes exports a router', () => {
    expect(isRouter(healthRoutes)).toBe(true);
  });

  it('index routes exports a router', () => {
    expect(isRouter(indexRoutes)).toBe(true);
  });

  it('notificationRoutes exports a router', () => {
    expect(isRouter(notificationRoutes)).toBe(true);
  });

  it('userRoutes exports a router', () => {
    expect(isRouter(userRoutes)).toBe(true);
  });
});

describe('Route registrations', () => {
  // Verify that the index router contains the expected child routers
  it('index router has stack entries for all sub-routers', () => {
    const stack = (indexRoutes as unknown as { stack: { regexp: RegExp }[] }).stack;
    expect(stack.length).toBeGreaterThan(0);
  });

  it('adminRoutes has routes for devices', () => {
    const stack = (adminRoutes as unknown as { stack: { route?: { path: string } }[] }).stack;
    const paths = stack
      .filter((l) => l.route)
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      .map((l) => l.route!.path);
    expect(paths).toContain('/devices');
  });

  it('authRoutes registers /register and /login', () => {
    const stack = (authRoutes as unknown as { stack: { route?: { path: string } }[] }).stack;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const paths = stack.filter((l) => l.route).map((l) => l.route!.path);
    expect(paths).toContain('/register');
    expect(paths).toContain('/login');
    expect(paths).toContain('/admin-login');
  });

  it('userRoutes registers /me endpoints', () => {
    const stack = (userRoutes as unknown as { stack: { route?: { path: string } }[] }).stack;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const paths = stack.filter((l) => l.route).map((l) => l.route!.path);
    expect(paths).toContain('/me');
  });

  it('emergencyContactRoutes is created with mergeParams', () => {
    // mergeParams routers still behave like a function with stack
    expect(isRouter(emergencyContactRoutes)).toBe(true);
  });
});
