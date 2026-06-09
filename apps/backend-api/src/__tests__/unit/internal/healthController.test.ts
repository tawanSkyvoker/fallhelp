/**
 * Health Controller Tests
 * Tests: getHealth — database connected/disconnected, MQTT connected/disconnected
 */

// Mock prisma
const mockQueryRaw = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: (...args: unknown[]) => mockQueryRaw(...args),
  },
}));

// Mock MQTT client
const mockIsClientConnected = jest.fn();

jest.mock('../../../iot/mqttClient', () => ({
  mqttClient: {
    isClientConnected: () => mockIsClientConnected(),
  },
}));

import { getHealth } from '../../../controllers/internal/healthController';

const makeReq = () => ({}) as unknown as import('express').Request;

const makeRes = () => {
  const res = {} as { status: jest.Mock; json: jest.Mock; send: jest.Mock };
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res as unknown as import('express').Response & {
    status: jest.Mock;
    json: jest.Mock;
    send: jest.Mock;
  };
};

describe('healthController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth', () => {
    it('should return 200 with status "ok" when database and MQTT are connected', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockIsClientConnected.mockReturnValue(true);

      const req = makeReq();
      const res = makeRes();

      await getHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          services: { database: 'connected', mqtt: 'connected' },
        }),
      );
    });

    it('should return 503 with status "degraded" when database is disconnected', async () => {
      mockQueryRaw.mockRejectedValue(new Error('Connection failed'));
      mockIsClientConnected.mockReturnValue(true);

      const req = makeReq();
      const res = makeRes();

      await getHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'degraded',
          services: { database: 'disconnected', mqtt: 'connected' },
        }),
      );
    });

    it('should return 200 when database is ok but MQTT is disconnected (MQTT is optional)', async () => {
      mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
      mockIsClientConnected.mockReturnValue(false);

      const req = makeReq();
      const res = makeRes();

      await getHealth(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ok',
          services: expect.objectContaining({ mqtt: 'disconnected' }),
        }),
      );
    });

    it('should include timestamp in response', async () => {
      mockQueryRaw.mockResolvedValue([]);
      mockIsClientConnected.mockReturnValue(false);

      const req = makeReq();
      const res = makeRes();

      await getHealth(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe('string');
    });

    it('should include responseTimeMs as a non-negative number', async () => {
      mockQueryRaw.mockResolvedValue([]);
      mockIsClientConnected.mockReturnValue(false);

      const req = makeReq();
      const res = makeRes();

      await getHealth(req, res);

      const body = res.json.mock.calls[0][0];
      expect(typeof body.responseTimeMs).toBe('number');
      expect(body.responseTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should include uptime string in response', async () => {
      mockQueryRaw.mockResolvedValue([]);
      mockIsClientConnected.mockReturnValue(false);

      const req = makeReq();
      const res = makeRes();

      await getHealth(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.uptime).toBeDefined();
      expect(typeof body.uptime).toBe('string');
    });

    it('should include version in response', async () => {
      mockQueryRaw.mockResolvedValue([]);
      mockIsClientConnected.mockReturnValue(false);

      const req = makeReq();
      const res = makeRes();

      await getHealth(req, res);

      const body = res.json.mock.calls[0][0];
      expect(body.version).toBeDefined();
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// formatUptime branches — lines 54-58 (days/hours/minutes=0 cases)
// The function is private but its output is visible through the health response
// ──────────────────────────────────────────────────────────────────────────
describe('formatUptime (via getHealth response)', () => {
  beforeEach(() => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockIsClientConnected.mockReturnValue(true);
  });

  it('returns "< 1m" when uptime is less than 60 seconds (all 0 branches hit)', async () => {
    // Freeze process.uptime to return a sub-minute value
    const uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(30);

    const req = makeReq();
    const res = makeRes();
    await getHealth(req, res);

    uptimeSpy.mockRestore();

    const body = res.json.mock.calls[0][0];
    expect(body.uptime).toBe('< 1m');
  });

  it('returns only minutes when uptime < 1 hour (days=0, hours=0 branch)', async () => {
    const uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(90); // 1m 30s

    const req = makeReq();
    const res = makeRes();
    await getHealth(req, res);

    uptimeSpy.mockRestore();

    const body = res.json.mock.calls[0][0];
    expect(body.uptime).toBe('1m');
  });

  it('returns hours + minutes when uptime < 1 day (days=0 branch)', async () => {
    const uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(3690); // 1h 1m 30s

    const req = makeReq();
    const res = makeRes();
    await getHealth(req, res);

    uptimeSpy.mockRestore();

    const body = res.json.mock.calls[0][0];
    expect(body.uptime).toBe('1h 1m');
  });

  it('returns full d/h/m when uptime > 1 day', async () => {
    const uptimeSpy = jest.spyOn(process, 'uptime').mockReturnValue(90060); // 1d 1h 1m

    const req = makeReq();
    const res = makeRes();
    await getHealth(req, res);

    uptimeSpy.mockRestore();

    const body = res.json.mock.calls[0][0];
    expect(body.uptime).toBe('1d 1h 1m');
  });
});
