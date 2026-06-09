/**
 * Admin Service Tests
 * Tests: getAllDevices, createDevice, deleteDevice, forceUnpairDevice
 */

// Mock Prisma
const mockDeviceCount = jest.fn();
const mockDeviceFindUnique = jest.fn();
const mockDeviceDelete = jest.fn();
const mockDeviceCreate = jest.fn();
const mockDeviceFindMany = jest.fn();
const mockDeviceUpdate = jest.fn();
const mockDeviceUpdateMany = jest.fn();

jest.mock('../../../prisma', () => ({
  __esModule: true,
  default: {
    device: {
      count: mockDeviceCount,
      findUnique: mockDeviceFindUnique,
      delete: mockDeviceDelete,
      create: mockDeviceCreate,
      findMany: mockDeviceFindMany,
      update: mockDeviceUpdate,
      updateMany: mockDeviceUpdateMany,
    },
  },
}));

// Mock MQTT client
const mockPublish = jest.fn();
jest.mock('../../../iot/mqttClient', () => ({
  mqttClient: { publish: mockPublish },
}));

// Mock deviceSerial utils
jest.mock('../../../utils/deviceSerial', () => ({
  isValidDeviceSerial: (s: string) => /^ESP32-[0-9A-F]{12}$/.test(s),
  normalizeDeviceSerial: (s: string) => s.toUpperCase(),
}));

// Mock deviceSemantics
jest.mock('../../../utils/deviceSemantics', () => ({
  attachDeviceSemantics: (device: { status: string; lastOnline?: Date | string | null }) => {
    // ใช้ logic จำลองที่สอดคล้องกับ deviceConnectivity mock
    const lastOnline = device.lastOnline;
    let onlineStatus = 'OFFLINE';
    if (lastOnline) {
      const ts = lastOnline instanceof Date ? lastOnline.getTime() : new Date(lastOnline).getTime();
      if (Date.now() - ts < 300000) onlineStatus = 'ONLINE';
    }
    return {
      ...device,
      pairingStatus: device.status,
      onlineStatus,
      isOnline: onlineStatus === 'ONLINE',
    };
  },
  attachNestedDeviceSemantics: (entity: {
    device: { status: string; lastOnline?: Date | string | null } | null;
  }) => {
    if (!entity || !entity.device) return entity;
    const lastOnline = entity.device.lastOnline;
    let onlineStatus = 'OFFLINE';
    if (lastOnline) {
      const ts = lastOnline instanceof Date ? lastOnline.getTime() : new Date(lastOnline).getTime();
      if (Date.now() - ts < 300000) onlineStatus = 'ONLINE';
    }
    return {
      ...entity,
      device: {
        ...entity.device,
        pairingStatus: entity.device.status,
        onlineStatus,
        isOnline: onlineStatus === 'ONLINE',
      },
    };
  },
}));

// Mock deviceConnectivity
jest.mock('../../../utils/deviceConnectivity', () => ({
  DEVICE_ONLINE_THRESHOLD_MS: 300000,
  getDeviceOnlineStatus: (lastOnline: Date | null) => {
    if (!lastOnline) return 'NEVER_CONNECTED';
    return Date.now() - lastOnline.getTime() < 300000 ? 'ONLINE' : 'OFFLINE';
  },
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    audit: jest.fn(),
  },
}));

import {
  getAllDevices,
  createDevice,
  deleteDevice,
  forceUnpairDevice,
  recoverInconsistentDevices,
} from '../../../services/adminService';
import { ApiError } from '../../../utils/ApiError';
import logger from '../../../utils/logger';

describe('Admin Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // getAllDevices
  // ==========================================
  describe('getAllDevices', () => {
    it('เรียก Prisma โดยตรงและคืน device list', async () => {
      mockDeviceUpdateMany.mockResolvedValue({ count: 0 });
      mockDeviceFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          id: 'device-001',
          serialNumber: 'ESP32-ABC',
          deviceCode: 'ABCD',
          status: 'PAIRED',
          lastOnline: new Date(),
          elderId: 'elder-001',
        },
      ]);

      const result = await getAllDevices();

      expect(mockDeviceFindMany).toHaveBeenCalledWith({
        where: {
          status: 'PAIRED',
          elderId: null,
        },
      });
      expect(mockDeviceFindMany).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'device-001', serialNumber: 'ESP32-ABC' });
    });

    it('เคลียร์ stale CONFIGURING ก่อนคืนให้', async () => {
      mockDeviceUpdateMany.mockResolvedValue({ count: 1 });
      mockDeviceFindMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await getAllDevices();

      expect(mockDeviceUpdateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ wifiStatus: 'CONFIGURING' }),
          data: expect.objectContaining({ wifiStatus: 'ERROR' }),
        }),
      );
    });

    it('กู้ device ที่ค้าง PAIRED แต่ไม่มี elderId ก่อนคืนรายการ admin', async () => {
      const inconsistentDevice = {
        id: 'device-inconsistent-001',
        serialNumber: 'ESP32-1234567890AB',
        status: 'PAIRED',
        elderId: null,
      };
      const visibleDevice = {
        id: 'device-visible-001',
        serialNumber: 'ESP32-ABC',
        deviceCode: 'ABCD',
        status: 'UNPAIRED',
        lastOnline: null,
        elderId: null,
      };

      mockDeviceUpdateMany.mockResolvedValue({ count: 0 });
      mockDeviceFindMany.mockResolvedValueOnce([inconsistentDevice]).mockResolvedValueOnce([
        visibleDevice,
      ]);
      mockDeviceUpdate.mockResolvedValue({
        ...inconsistentDevice,
        status: 'UNPAIRED',
        wifiStatus: 'DISCONNECTED',
      });
      mockPublish.mockResolvedValue(undefined);

      await getAllDevices();

      expect(mockDeviceUpdate).toHaveBeenCalledWith({
        where: { id: 'device-inconsistent-001' },
        data: {
          status: 'UNPAIRED',
          wifiStatus: 'DISCONNECTED',
        },
      });
      expect(mockPublish).toHaveBeenCalledWith(
        'device/ESP32-1234567890AB/config',
        expect.objectContaining({
          action: 'RESET_NVS',
          reason: 'ADMIN_FORCE_UNPAIR',
          deviceSerial: 'ESP32-1234567890AB',
          requestId: expect.any(String),
        }),
        { retain: true },
      );
    });
  });

  describe('recoverInconsistentDevices', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('ไม่ทำอะไรเมื่อไม่มี device ที่ข้อมูลไม่สอดคล้อง', async () => {
      mockDeviceFindMany.mockResolvedValue([]);

      await recoverInconsistentDevices();

      expect(mockDeviceFindMany).toHaveBeenCalledWith({
        where: {
          status: 'PAIRED',
          elderId: null,
        },
      });
      expect(mockDeviceUpdate).not.toHaveBeenCalled();
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('เปลี่ยน device ที่ข้อมูลไม่สอดคล้องเป็น UNPAIRED และส่ง RESET_NVS แบบ retained', async () => {
      const fakeDevice = {
        id: 'device-001',
        serialNumber: 'ESP32-1234567890AB',
        status: 'PAIRED',
        elderId: null,
      };

      mockDeviceFindMany.mockResolvedValue([fakeDevice]);
      mockDeviceUpdate.mockResolvedValue({
        ...fakeDevice,
        status: 'UNPAIRED',
        wifiStatus: 'DISCONNECTED',
      });
      mockPublish.mockResolvedValue(undefined);

      await recoverInconsistentDevices();

      expect(mockDeviceUpdate).toHaveBeenCalledWith({
        where: { id: 'device-001' },
        data: {
          status: 'UNPAIRED',
          wifiStatus: 'DISCONNECTED',
        },
      });

      expect(mockPublish).toHaveBeenCalledWith(
        'device/ESP32-1234567890AB/config',
        expect.objectContaining({
          action: 'RESET_NVS',
          reason: 'ADMIN_FORCE_UNPAIR',
          deviceSerial: 'ESP32-1234567890AB',
          requestId: expect.any(String),
        }),
        { retain: true },
      );
    });
  });

  // ==========================================
  // deleteDevice
  // ==========================================
  describe('deleteDevice', () => {
    it('ลบอุปกรณ์ที่ยังไม่ถูกจับคู่และบันทึก audit log', async () => {
      const device = {
        id: 'device-001',
        serialNumber: 'ESP32-6C689BDAF380',
        deviceCode: 'ABCD1234',
        status: 'UNPAIRED',
        elderId: null,
      };
      mockDeviceFindUnique.mockResolvedValue(device);
      mockDeviceDelete.mockResolvedValue(device);

      const result = await deleteDevice('device-001');

      expect(mockDeviceDelete).toHaveBeenCalledWith({ where: { id: 'device-001' } });
      expect(result).toEqual(device);
      expect(logger.audit).toHaveBeenCalledWith(
        'device_deleted',
        expect.objectContaining({
          deviceId: 'device-001',
          serialNumber: 'ESP32-6C689BDAF380',
          deviceCode: 'ABCD1234',
        }),
      );
    });

    it('โยน device_not_found เมื่อ delete device ที่ไม่มีอยู่', async () => {
      mockDeviceFindUnique.mockResolvedValue(null);

      await expect(deleteDevice('missing-device')).rejects.toMatchObject({
        code: 'device_not_found',
      });
      expect(mockDeviceDelete).not.toHaveBeenCalled();
    });

    it('ไม่ให้ลบ device ที่ status เป็น PAIRED', async () => {
      mockDeviceFindUnique.mockResolvedValue({
        id: 'device-001',
        serialNumber: 'ESP32-6C689BDAF380',
        deviceCode: 'ABCD1234',
        status: 'PAIRED',
        elderId: null,
      });

      await expect(deleteDevice('device-001')).rejects.toMatchObject({
        code: 'device_already_paired',
      });
      expect(mockDeviceDelete).not.toHaveBeenCalled();
    });

    it('ไม่ให้ลบ device ที่ยังมี elderId แม้ status ไม่ใช่ PAIRED', async () => {
      mockDeviceFindUnique.mockResolvedValue({
        id: 'device-001',
        serialNumber: 'ESP32-6C689BDAF380',
        deviceCode: 'ABCD1234',
        status: 'UNPAIRED',
        elderId: 'elder-001',
      });

      await expect(deleteDevice('device-001')).rejects.toMatchObject({
        code: 'device_already_paired',
      });
      expect(mockDeviceDelete).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // createDevice
  // ==========================================
  describe('createDevice', () => {
    it('สร้าง device และบันทึก audit log', async () => {
      mockDeviceCreate.mockResolvedValue({
        id: 'device-001',
        serialNumber: 'ESP32-6C689BDAF380',
        deviceCode: 'ABCD1234',
        status: 'UNPAIRED',
      });

      const result = await createDevice({ serialNumber: 'esp32-6c689bdaf380' });

      expect(mockDeviceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serialNumber: 'ESP32-6C689BDAF380',
            status: 'UNPAIRED',
          }),
        }),
      );
      expect(result).toMatchObject({ serialNumber: 'ESP32-6C689BDAF380' });
      expect(logger.audit).toHaveBeenCalledWith(
        'device_created',
        expect.objectContaining({
          deviceId: 'device-001',
          serialNumber: 'ESP32-6C689BDAF380',
        }),
      );
    });

    it('ปฏิเสธ serial ผิดรูปแบบก่อน write DB', async () => {
      await expect(createDevice({ serialNumber: 'ESP32-1234' })).rejects.toMatchObject<
        Partial<ApiError>
      >({
        code: 'validation_error',
        statusCode: 400,
        message: 'รูปแบบหมายเลขอุปกรณ์ไม่ถูกต้อง ต้องเป็น ESP32-XXXXXXXXXXXX',
      });
      expect(mockDeviceCreate).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // forceUnpairDevice
  // ==========================================
  describe('forceUnpairDevice', () => {
    const PAIRED_DEVICE = {
      id: 'device-001',
      serialNumber: 'ESP32-6C689BDAF380',
      status: 'PAIRED',
      elderId: 'elder-001',
    };

    beforeEach(() => {
      jest.clearAllMocks();
      mockDeviceFindUnique.mockResolvedValue(PAIRED_DEVICE);
      mockDeviceUpdate.mockResolvedValue({ ...PAIRED_DEVICE, elderId: null, status: 'UNPAIRED' });
      mockPublish.mockResolvedValue(undefined);
    });

    it('บังคับ unpair อุปกรณ์ที่จับคู่อยู่และส่ง RESET_NVS', async () => {
      const result = await forceUnpairDevice('device-001', 'admin-001');

      expect(mockDeviceUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ elderId: null, status: 'UNPAIRED' }),
        }),
      );
      expect(result).toMatchObject({ status: 'UNPAIRED' });
    });

    it('unpair ได้แม้ไม่ส่ง actorId (system unpair)', async () => {
      const result = await forceUnpairDevice('device-001');
      expect(result).toMatchObject({ status: 'UNPAIRED' });
    });

    it('โยน device_not_found เมื่อไม่เจอ device', async () => {
      mockDeviceFindUnique.mockResolvedValue(null);
      await expect(forceUnpairDevice('nonexistent')).rejects.toMatchObject({
        code: 'device_not_found',
      });
    });

    it('ไม่ส่ง MQTT เมื่ออุปกรณ์ไม่ได้อยู่ในสถานะ PAIRED', async () => {
      mockDeviceFindUnique.mockResolvedValue({
        ...PAIRED_DEVICE,
        status: 'UNPAIRED',
        serialNumber: null,
      });
      mockDeviceUpdate.mockResolvedValue({ ...PAIRED_DEVICE, elderId: null, status: 'UNPAIRED' });

      await forceUnpairDevice('device-001', 'admin-001');

      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('ยัง unpair สำเร็จเมื่อส่ง RESET_NVS ผ่าน MQTT ไม่สำเร็จ', async () => {
      mockPublish.mockRejectedValue(new Error('mqtt down'));

      const result = await forceUnpairDevice('device-001', 'admin-001');

      expect(result).toMatchObject({ status: 'UNPAIRED' });
      expect(mockPublish).toHaveBeenCalledWith(
        'device/ESP32-6C689BDAF380/config',
        expect.objectContaining({
          action: 'RESET_NVS',
          reason: 'ADMIN_FORCE_UNPAIR',
          deviceSerial: 'ESP32-6C689BDAF380',
        }),
      );
    });
  });
});
