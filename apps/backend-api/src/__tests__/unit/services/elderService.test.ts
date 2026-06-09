/**
 * Elder Service Tests
 * Tests: createElder, getCurrentElder, getElderById, updateElder
 */

// Mock Prisma
const mockElderCreate = jest.fn();
const mockElderFindUnique = jest.fn();
const mockElderUpdate = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    elder: {
      create: mockElderCreate,
      findUnique: mockElderFindUnique,
      update: mockElderUpdate,
    },
  },
}));

// Mock notification
jest.mock('../../../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../utils/deviceConnectivity', () => ({
  getDeviceOnlineStatus: (lastOnline: Date | null) => {
    if (!lastOnline) return 'NEVER_CONNECTED';
    return Date.now() - lastOnline.getTime() < 300000 ? 'ONLINE' : 'OFFLINE';
  },
}));

jest.mock('../../../generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      meta: Record<string, unknown> | undefined;
      constructor(
        message: string,
        opts: { code: string; meta?: Record<string, unknown>; clientVersion: string },
      ) {
        super(message);
        this.code = opts.code;
        this.meta = opts.meta;
        this.name = 'PrismaClientKnownRequestError';
      }
    },
  },
}));

import {
  createElder,
  getCurrentElder,
  getElderById,
  updateElder,
} from '../../../services/elderService';

// ==========================================
// Test Data
// ==========================================
const mockElder = {
  id: 'elder-001',
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  gender: 'MALE',
  dateOfBirth: new Date('1940-01-01'),
  userId: 'user-001',
  device: null,
};

describe('Elder Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // createElder
  // ==========================================
  describe('createElder', () => {
    it('should create elder with userId as owner', async () => {
      mockElderCreate.mockResolvedValue(mockElder);

      const result = await createElder('user-001', {
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        gender: 'MALE',
      });

      expect(result.firstName).toBe('สมชาย');
      expect(mockElderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user-001',
          }),
        }),
      );
    });

    it('should normalize full optional profile payload before creating elder', async () => {
      mockElderCreate.mockResolvedValue({
        ...mockElder,
        dateOfBirth: new Date(Date.UTC(1940, 0, 2)),
        height: 160,
        weight: 55,
        diseases: null,
      });

      const result = await createElder('user-001', {
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        gender: 'MALE',
        dateOfBirth: '1940-01-02',
        height: 160,
        weight: 55,
        diseases: null,
        houseNumber: '10',
        villageNumber: '2',
        villageName: null,
        subdistrict: 'คลองตัน',
        district: 'คลองเตย',
        province: 'กรุงเทพมหานคร',
        zipcode: '10110',
      });

      expect(result.dateOfBirth).toBe('1940-01-02');
      expect(mockElderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            gender: 'MALE',
            dateOfBirth: new Date(Date.UTC(1940, 0, 2)),
            height: 160,
            weight: 55,
            diseases: null,
            houseNumber: '10',
            villageNumber: '2',
            villageName: null,
            subdistrict: 'คลองตัน',
            district: 'คลองเตย',
            province: 'กรุงเทพมหานคร',
            zipcode: '10110',
          }),
        }),
      );
    });

    it('should reject non-integer height before creating elder', async () => {
      await expect(
        createElder('user-001', {
          firstName: 'สมชาย',
          lastName: 'ใจดี',
          height: 160.5,
        }),
      ).rejects.toMatchObject({
        code: 'validation_error',
        message: 'ส่วนสูงต้องเป็นจำนวนเต็ม',
      });

      expect(mockElderCreate).not.toHaveBeenCalled();
    });

    it('should normalize non-date-only string values and serialize them as date-only response', async () => {
      const isoDate = '1940-01-03T08:30:00.000Z';
      mockElderCreate.mockResolvedValue({
        ...mockElder,
        dateOfBirth: new Date(isoDate),
      });

      const result = await createElder('user-001', {
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        dateOfBirth: isoDate,
      });

      expect(result.dateOfBirth).toBe('1940-01-03');
      expect(mockElderCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dateOfBirth: new Date(isoDate),
          }),
        }),
      );
    });
  });

  // ==========================================
  // getCurrentElder
  // ==========================================
  describe('getCurrentElder', () => {
    it('should return elder belonging to user', async () => {
      mockElderFindUnique.mockResolvedValue(mockElder);

      const result = await getCurrentElder('user-001');

      expect(result?.id).toBe('elder-001');
      expect(mockElderFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: 'user-001' }),
        }),
      );
    });

    it('should return null if user has no elder', async () => {
      mockElderFindUnique.mockResolvedValue(null);

      const result = await getCurrentElder('user-001');

      expect(result).toBeNull();
    });

    it('should preserve null dateOfBirth in response', async () => {
      mockElderFindUnique.mockResolvedValue({ ...mockElder, dateOfBirth: null });

      const result = await getCurrentElder('user-001');

      expect(result?.dateOfBirth).toBeNull();
    });

    it('should compute onlineStatus and isOnline when elder has a paired device (lines 71-72)', async () => {
      const recentLastOnline = new Date(Date.now() - 60_000); // 1 minute ago → ONLINE
      const elderWithDevice = {
        ...mockElder,
        device: {
          id: 'device-001',
          serialNumber: 'ESP32-ABC',
          status: 'PAIRED',
          lastOnline: recentLastOnline,
          wifiStatus: 'CONNECTED',
        },
      };
      mockElderFindUnique.mockResolvedValue(elderWithDevice);

      const result = await getCurrentElder('user-001');

      expect(result?.device).not.toBeNull();
      const device = result?.device as Record<string, unknown>;
      expect(device['onlineStatus']).toBe('ONLINE');
      expect(device['isOnline']).toBe(true);
      expect(device['pairingStatus']).toBe('PAIRED');
      expect(device['wifiStatus']).toBe('CONNECTED');
    });

    it('should compute OFFLINE status for device with stale lastOnline', async () => {
      const staleLastOnline = new Date(Date.now() - 10 * 60_000); // 10 minutes ago → OFFLINE
      const elderWithOfflineDevice = {
        ...mockElder,
        device: {
          id: 'device-002',
          serialNumber: 'ESP32-DEF',
          status: 'PAIRED',
          lastOnline: staleLastOnline,
          wifiStatus: 'DISCONNECTED',
        },
      };
      mockElderFindUnique.mockResolvedValue(elderWithOfflineDevice);

      const result = await getCurrentElder('user-001');

      expect(result?.device).not.toBeNull();
      const device = result?.device as Record<string, unknown>;
      expect(device['isOnline']).toBe(false);
      expect(device['wifiStatus']).toBe('DISCONNECTED');
    });
  });

  // ==========================================
  // getElderById
  // ==========================================
  describe('getElderById', () => {
    it('should return elder owned by user', async () => {
      mockElderFindUnique.mockResolvedValue({ ...mockElder, emergencyContacts: [] });

      const result = await getElderById('user-001', 'elder-001');

      expect(result.firstName).toBe('สมชาย');
      expect(mockElderFindUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: 'elder-001' }),
        }),
      );
    });

    it('should throw if elder not found or user does not own it', async () => {
      mockElderFindUnique.mockResolvedValue(null);

      await expect(getElderById('user-999', 'elder-001')).rejects.toMatchObject({
        code: 'elder_not_found',
      });
    });

    it('should throw elder_not_found when elder belongs to another user', async () => {
      mockElderFindUnique.mockResolvedValue({ ...mockElder, userId: 'user-002' });

      await expect(getElderById('user-001', 'elder-001')).rejects.toMatchObject({
        code: 'elder_not_found',
      });
    });

    it('should compute onlineStatus for paired device in getElderById (lines 102-103)', async () => {
      const recentLastOnline = new Date(Date.now() - 60_000); // 1 minute ago → ONLINE
      const elderWithDevice = {
        ...mockElder,
        emergencyContacts: [],
        device: {
          id: 'device-001',
          serialNumber: 'ESP32-ABC',
          status: 'PAIRED',
          lastOnline: recentLastOnline,
          wifiStatus: 'CONNECTED',
        },
      };
      mockElderFindUnique.mockResolvedValue(elderWithDevice);

      const result = await getElderById('user-001', 'elder-001');

      const device = result.device as Record<string, unknown>;
      expect(device).not.toBeNull();
      expect(device['onlineStatus']).toBe('ONLINE');
      expect(device['isOnline']).toBe(true);
      expect(device['pairingStatus']).toBe('PAIRED');
      expect(device['wifiStatus']).toBe('CONNECTED');
    });

    it('should expose DISCONNECTED wifiStatus when device wifiStatus is DISCONNECTED', async () => {
      const elderWithDeviceNoConfig = {
        ...mockElder,
        emergencyContacts: [],
        device: {
          id: 'device-002',
          serialNumber: 'ESP32-DEF',
          status: 'PAIRED',
          lastOnline: new Date(Date.now() - 600_000), // 10 min ago → OFFLINE
          wifiStatus: 'DISCONNECTED',
        },
      };
      mockElderFindUnique.mockResolvedValue(elderWithDeviceNoConfig);

      const result = await getElderById('user-001', 'elder-001');

      const device = result.device as Record<string, unknown>;
      expect(device['isOnline']).toBe(false);
      expect(device['wifiStatus']).toBe('DISCONNECTED');
    });
  });

  // ==========================================
  // updateElder
  // ==========================================
  describe('updateElder', () => {
    it('should update elder owned by user', async () => {
      mockElderFindUnique.mockResolvedValue(mockElder);
      mockElderUpdate.mockResolvedValue({ ...mockElder, firstName: 'สมหญิง' });

      const result = await updateElder('user-001', 'elder-001', { firstName: 'สมหญิง' });

      expect(result.firstName).toBe('สมหญิง');
      expect(mockElderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'elder-001' },
          data: expect.objectContaining({ firstName: 'สมหญิง' }),
        }),
      );
    });

    it('should update all optional elder fields and normalize Date input to date-only', async () => {
      mockElderFindUnique.mockResolvedValue(mockElder);
      mockElderUpdate.mockResolvedValue({
        ...mockElder,
        firstName: 'สมหญิง',
        lastName: 'ใจเย็น',
        gender: 'FEMALE',
        dateOfBirth: new Date(Date.UTC(1941, 3, 5)),
        height: 155,
        weight: 52,
        diseases: null,
        houseNumber: '99',
        villageNumber: '8',
        villageName: null,
        subdistrict: 'บางนา',
        district: 'บางนา',
        province: 'กรุงเทพมหานคร',
        zipcode: '10260',
      });

      const inputDate = new Date('1941-04-05T13:45:00+07:00');
      const result = await updateElder('user-001', 'elder-001', {
        firstName: 'สมหญิง',
        lastName: 'ใจเย็น',
        gender: 'FEMALE',
        dateOfBirth: inputDate,
        height: 155,
        weight: 52,
        diseases: null,
        houseNumber: '99',
        villageNumber: '8',
        villageName: null,
        subdistrict: 'บางนา',
        district: 'บางนา',
        province: 'กรุงเทพมหานคร',
        zipcode: '10260',
      });

      expect(result.dateOfBirth).toBe('1941-04-05');
      expect(mockElderUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            firstName: 'สมหญิง',
            lastName: 'ใจเย็น',
            gender: 'FEMALE',
            dateOfBirth: new Date(Date.UTC(1941, 3, 5)),
            height: 155,
            weight: 52,
            diseases: null,
            houseNumber: '99',
            villageNumber: '8',
            villageName: null,
            subdistrict: 'บางนา',
            district: 'บางนา',
            province: 'กรุงเทพมหานคร',
            zipcode: '10260',
          }),
        }),
      );
    });

    it('should reject non-integer height before updating elder', async () => {
      await expect(
        updateElder('user-001', 'elder-001', {
          height: 155.2,
        }),
      ).rejects.toMatchObject({
        code: 'validation_error',
        message: 'ส่วนสูงต้องเป็นจำนวนเต็ม',
      });

      expect(mockElderFindUnique).not.toHaveBeenCalled();
      expect(mockElderUpdate).not.toHaveBeenCalled();
    });

    it('should throw if user does not own elder', async () => {
      mockElderFindUnique.mockResolvedValue(null);

      await expect(
        updateElder('user-002', 'elder-001', { firstName: 'Test' }),
      ).rejects.toMatchObject({ code: 'access_denied' });
    });
  });
});
