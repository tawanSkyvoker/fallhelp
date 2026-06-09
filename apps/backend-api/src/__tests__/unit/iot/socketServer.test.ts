/**
 * Unit tests for socketServer.ts — SocketServerManager
 *
 * Strategy:
 * - Mock socket.io Server class
 * - Mock prisma, jwt, deviceConnectivity, origin utilities
 * - Drive connection/auth/disconnect/event flows by capturing the
 *   event listeners registered on the mock io/socket instances
 */

// ── Mocks (must be before imports) ──────────────────────────────────────────

// Capture the connection handler so we can invoke it manually
let capturedConnectionHandler: ((socket: unknown) => void) | null = null;

const mockIoEmit = jest.fn();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockIoTo = jest.fn();
const mockIoClose = jest.fn();

// Build a chainable .to() mock that supports .to().to().emit()
const buildToChain = () => {
  const chain = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };
  return chain;
};

const mockServerInstance = {
  on: jest.fn((event: string, handler: (socket: unknown) => void) => {
    if (event === 'connection') {
      capturedConnectionHandler = handler;
    }
  }),
  to: jest.fn(() => buildToChain()),
  emit: mockIoEmit,
  close: mockIoClose,
};

jest.mock('socket.io', () => ({
  Server: jest.fn(() => mockServerInstance),
}));

const mockVerifyToken = jest.fn();
jest.mock('../../../utils/jwt', () => ({
  verifyToken: mockVerifyToken,
}));

const mockElderFindUnique = jest.fn();
jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    elder: {
      findUnique: mockElderFindUnique,
    },
  },
}));

const mockGetDeviceOnlineStatus = jest.fn();
jest.mock('../../../utils/deviceConnectivity', () => ({
  getDeviceOnlineStatus: mockGetDeviceOnlineStatus,
}));

const mockIsAllowedClientOrigin = jest.fn().mockReturnValue(true);
jest.mock('../../../config/origin', () => ({
  isAllowedClientOrigin: mockIsAllowedClientOrigin,
}));

jest.mock('debug', () => {
  const fn = () => {};
  return { __esModule: true, default: () => fn };
});

// ── Now import after mocks are registered ────────────────────────────────────
import { Server } from 'socket.io';
import { socketServer } from '../../../realtime/socketServer';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal mock Socket */
const createMockSocket = (id = 'socket-1') => {
  const handlers: Record<string, ((...args: unknown[]) => unknown)[]> = {};
  const socket = {
    id,
    on: jest.fn((event: string, handler: (...args: unknown[]) => unknown) => {
      handlers[event] = handlers[event] ?? [];
      handlers[event].push(handler);
    }),
    emit: jest.fn(),
    join: jest.fn(),
    disconnect: jest.fn(),
    // helper for tests to fire events
    _fire: (event: string, ...args: unknown[]) => {
      (handlers[event] ?? []).forEach((h) => h(...args));
    },
  };
  return socket;
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('SocketServerManager', () => {
  beforeEach(() => {
    // ล้าง connectedClients ของ singleton ก่อนทุก test เพื่อไม่ให้ค่าจากเทสก่อนหน้าตกค้าง
    socketServer.close();
    jest.clearAllMocks();
    capturedConnectionHandler = null;
    // Re-initialise to get fresh state; re-mock on() to capture handler
    mockServerInstance.on.mockImplementation(
      (event: string, handler: (socket: unknown) => void) => {
        if (event === 'connection') {
          capturedConnectionHandler = handler;
        }
      },
    );
    mockServerInstance.to.mockImplementation(() => buildToChain());
  });

  // ── initialize ─────────────────────────────────────────────────────────────

  describe('initialize()', () => {
    it('creates a socket.io Server with correct options', () => {
      const fakeHttpServer = {} as never;
      socketServer.initialize(fakeHttpServer);

      expect(Server).toHaveBeenCalledWith(
        fakeHttpServer,
        expect.objectContaining({
          transports: ['websocket', 'polling'],
          pingInterval: 25000,
          pingTimeout: 20000,
        }),
      );
    });

    it('registers a connection listener', () => {
      const fakeHttpServer = {} as never;
      socketServer.initialize(fakeHttpServer);
      expect(mockServerInstance.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('CORS origin callback allows whitelisted origins', () => {
      const fakeHttpServer = {} as never;
      mockIsAllowedClientOrigin.mockReturnValue(true);

      socketServer.initialize(fakeHttpServer);

      // Extract the cors.origin function from the Server constructor call
      const callArgs = (Server as unknown as jest.Mock).mock.calls.at(-1)?.[1];
      const corsOriginFn = (
        callArgs as {
          cors: { origin: (o: string, cb: (e: null | Error, v?: boolean) => void) => void };
        }
      ).cors.origin;

      const callback = jest.fn();
      corsOriginFn('http://localhost:8081', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('CORS origin callback rejects unknown origins', () => {
      mockIsAllowedClientOrigin.mockReturnValue(false);

      const fakeHttpServer = {} as never;
      socketServer.initialize(fakeHttpServer);

      const callArgs = (Server as unknown as jest.Mock).mock.calls.at(-1)?.[1];
      const corsOriginFn = (
        callArgs as {
          cors: { origin: (o: string, cb: (e: null | Error, v?: boolean) => void) => void };
        }
      ).cors.origin;

      const callback = jest.fn();
      corsOriginFn('http://evil.com', callback);
      expect(callback).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  // ── handleConnection ───────────────────────────────────────────────────────

  describe('handleConnection()', () => {
    let socket: ReturnType<typeof createMockSocket>;

    beforeEach(() => {
      socketServer.initialize({} as never);
      socket = createMockSocket('test-socket');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(socket);
    });

    it('stores socket in connectedClients', () => {
      expect(socketServer.getConnectedClientsCount()).toBe(1);
    });

    it('registers authenticate, disconnect, and ping handlers', () => {
      expect(socket.on).toHaveBeenCalledWith('authenticate', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(socket.on).toHaveBeenCalledWith('ping', expect.any(Function));
    });

    it('responds to ping with pong', () => {
      socket._fire('ping');
      expect(socket.emit).toHaveBeenCalledWith(
        'pong',
        expect.objectContaining({ timestamp: expect.any(String) }),
      );
    });
  });

  // ── authenticate handler ───────────────────────────────────────────────────

  describe('authenticate event', () => {
    let socket: ReturnType<typeof createMockSocket>;

    beforeEach(() => {
      socketServer.initialize({} as never);
      socket = createMockSocket('auth-socket');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(socket);
    });

    it('rejects when token is missing', async () => {
      await socket._fire('authenticate', {});
      expect(socket.emit).toHaveBeenCalledWith('authenticated', {
        success: false,
        error: 'Token is required',
      });
    });

    it('rejects when token is invalid', async () => {
      mockVerifyToken.mockImplementation(() => {
        throw new Error('bad token');
      });

      await socket._fire('authenticate', { token: 'bad' });
      expect(socket.emit).toHaveBeenCalledWith('authenticated', {
        success: false,
        error: 'Invalid or expired token',
      });
    });

    it('authenticates successfully and joins user room', async () => {
      mockVerifyToken.mockReturnValue({ userId: 'user-1', role: 'CAREGIVER', email: 'a@b.com' });
      mockElderFindUnique.mockResolvedValue(null);

      await socket._fire('authenticate', { token: 'valid' });

      expect(socket.join).toHaveBeenCalledWith('user:user-1');
      expect(socket.emit).toHaveBeenCalledWith('authenticated', {
        success: true,
        userId: 'user-1',
      });
    });

    it('authenticates ADMIN role without joining extra admin room', async () => {
      mockVerifyToken.mockReturnValue({ userId: 'admin-1', role: 'ADMIN', email: 'admin@b.com' });
      mockElderFindUnique.mockResolvedValue(null);

      await socket._fire('authenticate', { token: 'admin-token' });

      expect(socket.join).not.toHaveBeenCalledWith('admin');
      expect(socket.join).toHaveBeenCalledWith('user:admin-1');
    });

    it('joins elder room when elderId is provided and ownership is verified', async () => {
      mockVerifyToken.mockReturnValue({ userId: 'user-2', role: 'CAREGIVER', email: 'u@b.com' });
      mockElderFindUnique.mockResolvedValue({
        id: 'elder-1',
        userId: 'user-2',
        firstName: 'John',
        lastName: 'Doe',
        device: null,
      });

      await socket._fire('authenticate', { token: 'valid', elderId: 'elder-1' });

      expect(socket.join).toHaveBeenCalledWith('elder:elder-1');
    });

    it('does not join elder room when ownership check fails', async () => {
      mockVerifyToken.mockReturnValue({ userId: 'user-3', role: 'CAREGIVER', email: 'u@b.com' });
      mockElderFindUnique.mockResolvedValue({
        id: 'elder-1',
        userId: 'other-user', // different owner
        firstName: 'John',
        lastName: 'Doe',
        device: null,
      });

      await socket._fire('authenticate', { token: 'valid', elderId: 'elder-1' });

      const joinCalls = (socket.join as jest.Mock).mock.calls.map((c) => c[0]);
      expect(joinCalls).not.toContain('elder:elder-1');
    });

    it('emits device_status_update when elder has a device on authenticate', async () => {
      mockVerifyToken.mockReturnValue({ userId: 'user-4', role: 'CAREGIVER', email: 'u@b.com' });
      mockGetDeviceOnlineStatus.mockReturnValue('ONLINE');
      mockElderFindUnique.mockResolvedValue({
        id: 'elder-2',
        userId: 'user-4',
        firstName: 'Jane',
        lastName: 'Smith',
        device: {
          id: 'dev-1',
          deviceCode: 'DEVICE-001',
          lastOnline: new Date('2026-03-25T00:00:00Z'),
        },
      });

      await socket._fire('authenticate', { token: 'valid', elderId: 'elder-2' });

      expect(socket.emit).toHaveBeenCalledWith(
        'device_status_update',
        expect.objectContaining({
          deviceId: 'dev-1',
          deviceCode: 'DEVICE-001',
          elderId: 'elder-2',
          online: true,
        }),
      );
    });

    it('emits device_status_update with current timestamp when lastOnline is null', async () => {
      mockVerifyToken.mockReturnValue({ userId: 'user-5', role: 'CAREGIVER', email: 'u@b.com' });
      mockGetDeviceOnlineStatus.mockReturnValue('OFFLINE');
      mockElderFindUnique.mockResolvedValue({
        id: 'elder-3',
        userId: 'user-5',
        firstName: 'Bob',
        lastName: 'Lee',
        device: {
          id: 'dev-2',
          deviceCode: 'DEVICE-002',
          lastOnline: null,
        },
      });

      await socket._fire('authenticate', { token: 'valid', elderId: 'elder-3' });

      expect(socket.emit).toHaveBeenCalledWith(
        'device_status_update',
        expect.objectContaining({ timestamp: expect.any(String) }),
      );
    });

    it('disconnects old session when same user reconnects', async () => {
      // First socket authenticates
      mockVerifyToken.mockReturnValue({ userId: 'user-dup', role: 'CAREGIVER', email: 'u@b.com' });
      mockElderFindUnique.mockResolvedValue(null);
      await socket._fire('authenticate', { token: 'valid' });

      // Second socket connects for same user
      const socket2 = createMockSocket('auth-socket-2');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(socket2);
      mockVerifyToken.mockReturnValue({ userId: 'user-dup', role: 'CAREGIVER', email: 'u@b.com' });
      await socket2._fire('authenticate', { token: 'valid' });

      // Old socket should have been disconnected
      expect(socket.disconnect).toHaveBeenCalledWith(true);
    });

    it('handles old session mapping where old socket is no longer in connectedClients', async () => {
      // Manually inject a stale userSessions entry pointing to a socket not in connectedClients
      mockVerifyToken.mockReturnValue({
        userId: 'user-stale',
        role: 'CAREGIVER',
        email: 'u@b.com',
      });
      mockElderFindUnique.mockResolvedValue(null);

      // First auth
      await socket._fire('authenticate', { token: 'valid' });

      // Simulate the old socket being removed from connectedClients externally (e.g. network drop)
      // without the session mapping being cleaned up
      // We do this by connecting a new socket; the old socket id will still be in userSessions
      // but we remove it from connectedClients to hit the `if (oldSocket)` false branch
      socket._fire('disconnect'); // clears connectedClients but also clears userSessions

      // Manually re-add the stale session to userSessions without a corresponding connectedClient
      // by authenticating socket first, then disconnecting and re-adding session mapping
      const socket3 = createMockSocket('stale-socket');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(socket3);
      mockVerifyToken.mockReturnValue({
        userId: 'user-stale2',
        role: 'CAREGIVER',
        email: 'u@b.com',
      });
      await socket3._fire('authenticate', { token: 'valid' });

      // Now connect a 4th socket for the same user, but remove socket3 from connectedClients first
      // to simulate the stale session path
      socket3._fire('disconnect'); // removes from connectedClients and userSessions
      // Manually inject stale session (socketId not in connectedClients)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (socketServer as any).userSessions.set('user-stale2', 'ghost-socket-id');

      const socket4 = createMockSocket('socket4');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(socket4);
      mockVerifyToken.mockReturnValue({
        userId: 'user-stale2',
        role: 'CAREGIVER',
        email: 'u@b.com',
      });

      // This should not throw even though ghost-socket-id is not in connectedClients
      await socket4._fire('authenticate', { token: 'valid' });
      expect(socket4.emit).toHaveBeenCalledWith('authenticated', {
        success: true,
        userId: 'user-stale2',
      });
    });

    it('emits error response on unexpected exception', async () => {
      mockVerifyToken.mockReturnValue({ userId: 'user-err', role: 'CAREGIVER', email: 'u@b.com' });
      mockElderFindUnique.mockRejectedValue(new Error('DB exploded'));

      await socket._fire('authenticate', { token: 'valid', elderId: 'elder-x' });

      expect(socket.emit).toHaveBeenCalledWith('authenticated', {
        success: false,
        error: 'Authentication failed',
      });
    });
  });

  // ── disconnect handler ─────────────────────────────────────────────────────

  describe('disconnect event', () => {
    it('removes socket from connectedClients on disconnect', async () => {
      socketServer.initialize({} as never);
      const socket = createMockSocket('disc-socket');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(socket);

      expect(socketServer.getConnectedClientsCount()).toBe(1);
      socket._fire('disconnect');
      expect(socketServer.getConnectedClientsCount()).toBe(0);
    });

    it('removes user session mapping on disconnect', async () => {
      socketServer.initialize({} as never);
      const socket = createMockSocket('sess-socket');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(socket);

      mockVerifyToken.mockReturnValue({ userId: 'user-sess', role: 'CAREGIVER', email: 'u@b.com' });
      mockElderFindUnique.mockResolvedValue(null);
      await socket._fire('authenticate', { token: 'valid' });

      socket._fire('disconnect');
      // After disconnect, a new socket for the same user should NOT trigger disconnect of old
      const socket2 = createMockSocket('sess-socket-2');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(socket2);
      mockVerifyToken.mockReturnValue({ userId: 'user-sess', role: 'CAREGIVER', email: 'u@b.com' });
      await socket2._fire('authenticate', { token: 'valid' });
      // socket was already disconnected so its disconnect() won't be called again
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  // ── emit methods ───────────────────────────────────────────────────────────

  describe('emitFallDetected()', () => {
    it('emits fall_detected to elder room', () => {
      socketServer.initialize({} as never);
      const toChain = buildToChain();
      mockServerInstance.to.mockReturnValue(toChain);

      socketServer.emitFallDetected({
        eventId: 'evt-1',
        elderId: 'elder-1',
        elderName: 'John',
        deviceId: 'dev-1',
        deviceCode: 'CODE-1',
        timestamp: new Date('2026-03-25T00:00:00Z'),
        accelerationMagnitude: 12.5,
      });

      expect(mockServerInstance.to).toHaveBeenCalledWith('elder:elder-1');
      expect(toChain.emit).toHaveBeenCalledWith(
        'fall_detected',
        expect.objectContaining({
          eventId: 'evt-1',
          timestamp: '2026-03-25T00:00:00.000Z',
        }),
      );
    });

    it('does nothing when io is not initialized', () => {
      // Create a fresh manager with no io
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { SocketServerManager } = jest.requireActual('../../../realtime/socketServer') as never;
      // We can only test the exported singleton indirectly — just verify no throws
      // when calling before initialize (reset state first by testing absence of crash)
      expect(() => {
        // Use a brand-new object that has io=null to verify guard
        const bare = Object.create(Object.getPrototypeOf(socketServer)) as typeof socketServer;
        Object.assign(bare, { io: null, connectedClients: new Map(), userSessions: new Map() });
        bare.emitFallDetected({
          eventId: 'x',
          elderId: 'e',
          elderName: 'n',
          deviceId: 'd',
          deviceCode: 'c',
          timestamp: new Date(),
          accelerationMagnitude: 0,
        });
      }).not.toThrow();
    });
  });

  describe('emitHeartRateUpdate()', () => {
    it('emits heart_rate_update to elder room', () => {
      socketServer.initialize({} as never);
      const toChain = buildToChain();
      mockServerInstance.to.mockReturnValue(toChain);

      socketServer.emitHeartRateUpdate({
        elderId: 'elder-2',
        elderName: 'Jane',
        deviceId: 'dev-2',
        deviceCode: 'CODE-2',
        timestamp: new Date('2026-03-25T01:00:00Z'),
        heartRate: 75,
        confidence: 'high',
      });

      expect(mockServerInstance.to).toHaveBeenCalledWith('elder:elder-2');
      expect(toChain.emit).toHaveBeenCalledWith(
        'heart_rate_update',
        expect.objectContaining({ heartRate: 75, timestamp: '2026-03-25T01:00:00.000Z' }),
      );
    });

    it('does nothing when io is not initialized', () => {
      const bare = Object.create(Object.getPrototypeOf(socketServer)) as typeof socketServer;
      Object.assign(bare, { io: null, connectedClients: new Map(), userSessions: new Map() });
      expect(() => {
        bare.emitHeartRateUpdate({
          elderId: 'e',
          elderName: 'n',
          deviceId: 'd',
          deviceCode: 'c',
          timestamp: new Date(),
          heartRate: 80,
        });
      }).not.toThrow();
    });
  });

  describe('emitDeviceStatusUpdate()', () => {
    it('emits device_status_update to elder room only', () => {
      socketServer.initialize({} as never);
      const toChain = buildToChain();
      mockServerInstance.to.mockReturnValue(toChain);

      socketServer.emitDeviceStatusUpdate({
        deviceId: 'dev-3',
        deviceCode: 'CODE-3',
        elderId: 'elder-3',
        elderName: 'Bob',
        online: true,
        timestamp: new Date('2026-03-25T02:00:00Z'),
      });

      expect(mockServerInstance.to).toHaveBeenCalledTimes(1);
      expect(mockServerInstance.to).toHaveBeenCalledWith('elder:elder-3');
      expect(toChain.emit).toHaveBeenCalledWith(
        'device_status_update',
        expect.objectContaining({ online: true }),
      );
    });

    it('does nothing when io is not initialized', () => {
      const bare = Object.create(Object.getPrototypeOf(socketServer)) as typeof socketServer;
      Object.assign(bare, { io: null, connectedClients: new Map(), userSessions: new Map() });
      expect(() => {
        bare.emitDeviceStatusUpdate({
          deviceId: 'd',
          deviceCode: 'c',
          elderId: 'e',
          elderName: 'n',
          online: false,
          timestamp: new Date(),
        });
      }).not.toThrow();
    });
  });

  describe('broadcastSystemMessage()', () => {
    it('emits system_message to all clients', () => {
      socketServer.initialize({} as never);

      socketServer.broadcastSystemMessage('Hello', { detail: 1 });

      expect(mockIoEmit).toHaveBeenCalledWith(
        'system_message',
        expect.objectContaining({ message: 'Hello', data: { detail: 1 } }),
      );
    });

    it('emits system_message without data when data is omitted', () => {
      socketServer.initialize({} as never);

      socketServer.broadcastSystemMessage('System check');

      expect(mockIoEmit).toHaveBeenCalledWith(
        'system_message',
        expect.objectContaining({ message: 'System check', timestamp: expect.any(String) }),
      );
    });

    it('does nothing when io is not initialized', () => {
      const bare = Object.create(Object.getPrototypeOf(socketServer)) as typeof socketServer;
      Object.assign(bare, { io: null, connectedClients: new Map(), userSessions: new Map() });
      expect(() => {
        bare.broadcastSystemMessage('test');
      }).not.toThrow();
    });
  });

  // ── getConnectedClientsCount ───────────────────────────────────────────────

  describe('getConnectedClientsCount()', () => {
    it('tracks count of connected sockets', () => {
      socketServer.initialize({} as never);
      const s1 = createMockSocket('c1');
      const s2 = createMockSocket('c2');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(s1);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(s2);
      expect(socketServer.getConnectedClientsCount()).toBe(2);

      s1._fire('disconnect');
      expect(socketServer.getConnectedClientsCount()).toBe(1);
    });
  });

  // ── close ──────────────────────────────────────────────────────────────────

  describe('close()', () => {
    it('closes the io server and clears clients', () => {
      socketServer.initialize({} as never);
      const s = createMockSocket('close-s');
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      capturedConnectionHandler!(s);
      expect(socketServer.getConnectedClientsCount()).toBe(1);

      socketServer.close();

      expect(mockIoClose).toHaveBeenCalled();
      expect(socketServer.getConnectedClientsCount()).toBe(0);
    });

    it('does nothing when not initialized', () => {
      // Just ensure close() on an uninitialized state does not throw
      const bare = Object.create(Object.getPrototypeOf(socketServer)) as typeof socketServer;
      Object.assign(bare, { io: null, connectedClients: new Map(), userSessions: new Map() });
      expect(() => bare.close()).not.toThrow();
    });
  });
});
