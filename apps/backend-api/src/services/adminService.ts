/**
 * adminService.ts
 *
 * Service สำหรับจัดการข้อมูลอุปกรณ์ระบบฝั่งผู้ดูแลระบบ (Admin)
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงรายชื่อ devices ทั้งระบบ
 * - จัดการอุปกรณ์สำหรับ admin เช่น สร้าง ลบ และ force unpair
 * - กู้คืนสถานะอุปกรณ์ที่ข้อมูล pairing ไม่สอดคล้อง
 * - เขียน audit log ใน action สำคัญของอุปกรณ์
 */

import crypto from 'crypto';

import prisma from '../prisma';
import { createError, ApiError } from '../utils/ApiError';
import { backendEnv } from '../config/env';
import logger from '../utils/logger';
import { isValidDeviceSerial, normalizeDeviceSerial } from '../utils/deviceSerial';
import { attachDeviceSemantics } from '../utils/deviceSemantics';
import { mqttClient } from '../iot/mqttClient';
import { MQTT_TOPICS } from '../iot/topics';

const generateDeviceCode = (): string => crypto.randomBytes(4).toString('hex').toUpperCase();

const WIFI_CONFIGURING_STALE_MS = backendEnv.wifiConfiguringStaleMs;

interface ResetNvsOptions {
  readonly retain?: boolean;
  readonly requestId?: string;
}

async function recoverStaleConfiguringDevices(): Promise<void> {
  const staleThreshold = new Date(Date.now() - WIFI_CONFIGURING_STALE_MS);

  // ถ้าอุปกรณ์ค้าง CONFIGURING เกินเวลาที่กำหนด ให้เปลี่ยนเป็น ERROR เพื่อไม่ให้หน้า admin ค้างสถานะเดิม
  await prisma.device.updateMany({
    where: { wifiStatus: 'CONFIGURING', updatedAt: { lt: staleThreshold } },
    data: { wifiStatus: 'ERROR', updatedAt: new Date() },
  });
}

const publishResetNvsBestEffort = (deviceSerial: string, options: ResetNvsOptions = {}): void => {
  const topic = MQTT_TOPICS.getConfigTopic(deviceSerial);
  const payload = {
    action: 'RESET_NVS',
    reason: 'ADMIN_FORCE_UNPAIR',
    deviceSerial,
    ...(options.requestId ? { requestId: options.requestId } : {}),
  };

  const publishPromise = options.retain
    ? mqttClient.publish(topic, payload, { retain: true })
    : mqttClient.publish(topic, payload);

  // ส่งคำสั่ง reset NVS แบบ best effort ถ้าส่งไม่สำเร็จไม่ทำให้ force unpair ล้ม
  void publishPromise.catch(() => undefined);
};

/**
 * กู้คืนสถานะของอุปกรณ์ที่ข้อมูลไม่สอดคล้อง
 * เช่น อุปกรณ์มีสถานะ PAIRED แต่ไม่มี elderId ผูกอยู่หลังข้อมูล elder ถูกลบหรือ reset
 */
export const recoverInconsistentDevices = async (): Promise<void> => {
  const inconsistentDevices = await prisma.device.findMany({
    where: {
      status: 'PAIRED',
      elderId: null,
    },
  });

  if (inconsistentDevices.length === 0) return;

  logger.info('Found inconsistent devices in PAIRED state without elderId', {
    count: inconsistentDevices.length,
  });

  for (const device of inconsistentDevices) {
    await prisma.device.update({
      where: { id: device.id },
      data: {
        status: 'UNPAIRED',
        wifiStatus: 'DISCONNECTED',
      },
    });

    if (device.serialNumber) {
      // retained ช่วยให้อุปกรณ์ที่ offline อยู่ได้รับคำสั่ง reset เมื่อกลับมา online
      publishResetNvsBestEffort(device.serialNumber, {
        retain: true,
        requestId: crypto.randomUUID(),
      });
    }

    logger.audit('device_unpaired', {
      actorId: 'system',
      deviceId: device.id,
      serialNumber: device.serialNumber,
      reason: 'SYSTEM_CLEANUP_NO_ELDER',
    });
  }
};

export const createDevice = async (data: { serialNumber: string; firmwareVersion?: string }) => {
  const serialNumber = normalizeDeviceSerial(data.serialNumber);

  if (!isValidDeviceSerial(serialNumber)) {
    throw createError.validationError('รูปแบบหมายเลขอุปกรณ์ไม่ถูกต้อง ต้องเป็น ESP32-XXXXXXXXXXXX');
  }

  // สร้าง deviceCode สำหรับใช้ pairing และบันทึกอุปกรณ์เป็น UNPAIRED ตั้งต้น
  const deviceCode = generateDeviceCode();
  const device = await prisma.device.create({
    data: { deviceCode, serialNumber, status: 'UNPAIRED' },
  });

  logger.audit('device_created', { deviceId: device.id, serialNumber: device.serialNumber });

  return device;
};

export const getAllDevices = async () => {
  // เคลียร์สถานะ CONFIGURING ที่ค้างก่อนดึงรายการ เพื่อให้ admin เห็นสถานะล่าสุดที่สุด
  await recoverStaleConfiguringDevices();

  // กู้คืนสถานะของอุปกรณ์ที่ข้อมูลไม่สอดคล้อง (เช่น elder ถูกลบแต่ device ยังมีสถานะ PAIRED)
  await recoverInconsistentDevices();

  const devices = await prisma.device.findMany({
    select: {
      id: true,
      serialNumber: true,
      deviceCode: true,
      status: true,
      lastOnline: true,
      elderId: true,
    },
  });

  return devices.map((device) => {
    const enriched = attachDeviceSemantics(device);
    const lean = { ...enriched };

    // หน้า admin devices ต้องการ response แบบ lean จึงตัด field semantic ภายในบางตัวออก
    Reflect.deleteProperty(lean, 'pairingStatus');
    Reflect.deleteProperty(lean, 'wifiStatus');
    Reflect.deleteProperty(lean, 'updatedAt');

    return lean;
  });
};

export const deleteDevice = async (id: string) => {
  // ค้นหาอุปกรณ์ก่อนลบ เพื่อเช็กสถานะ pairing และใช้ข้อมูลสำหรับ audit log
  const device = await prisma.device.findUnique({
    where: { id },
  });

  if (!device) {
    throw createError.deviceNotFound();
  }

  if (device.status === 'PAIRED' || device.elderId) {
    throw new ApiError(
      'device_already_paired',
      'ไม่สามารถลบอุปกรณ์ที่ถูกจับคู่อยู่ กรุณายกเลิกการจับคู่ก่อน',
    );
  }

  return prisma.device
    .delete({
      where: { id },
    })
    .then((deleted) => {
      logger.audit('device_deleted', {
        deviceId: id,
        serialNumber: device.serialNumber,
        deviceCode: device.deviceCode,
      });

      return deleted;
    });
};

export const forceUnpairDevice = async (deviceId: string, actorId?: string) => {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });

  if (!device) {
    throw createError.deviceNotFound();
  }

  // reset WiFi เฉพาะอุปกรณ์ที่เคยจับคู่และมี serialNumber สำหรับส่ง MQTT
  const shouldReset = Boolean(device.serialNumber) && device.status === 'PAIRED';

  const unpaired = await prisma.device.update({
    where: { id: deviceId },
    data: { elderId: null, status: 'UNPAIRED', wifiStatus: 'DISCONNECTED' },
  });

  if (shouldReset) {
    publishResetNvsBestEffort(device.serialNumber);
  }

  logger.audit('device_unpaired', {
    actorId: actorId ?? 'system',
    deviceId,
    serialNumber: device.serialNumber,
    reason: 'ADMIN_FORCE_UNPAIR',
  });

  return unpaired;
};
