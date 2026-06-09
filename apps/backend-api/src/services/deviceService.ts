/**
 * deviceService.ts
 *
 * Service สำหรับ business logic ของอุปกรณ์ ESP32
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - ดึงข้อมูลอุปกรณ์จาก deviceCode
 * - จับคู่และยกเลิกจับคู่อุปกรณ์กับผู้สูงอายุ
 * - ส่งคำสั่งตั้งค่า WiFi ผ่าน MQTT และรอ ACK จากอุปกรณ์
 * - กู้สถานะ CONFIGURING ที่ค้างนานเกินไปให้เป็น ERROR
 * - ส่ง RESET_WIFI แบบ best effort ตอน unpair
 */

import crypto from 'crypto';
import createDebug from 'debug';

import { createError } from '../utils/ApiError';
import { mqttClient } from '../iot/mqttClient';
import { MQTT_TOPICS } from '../iot/topics';
import logger from '../utils/logger';
import { backendEnv } from '../config/env';
import prisma from '../prisma';
import { DEVICE_STATUSES, WIFI_STATUSES } from '../constants/domain';
import type { DeviceStatus, WifiStatus } from '../constants/domain';

const log = createDebug('fallhelp:device');
const WIFI_CONFIGURING_STALE_MS = backendEnv.wifiConfiguringStaleMs;
const ACK_INFRA_ERROR_HINTS = ['Timed out', 'offline', 'disconnected', 'connection error'] as const;

const isStaleConfiguring = (updatedAt?: Date | null): boolean => {
  if (!updatedAt) return true;

  // CONFIGURING ที่ค้างเกิน threshold มักแปลว่าอุปกรณ์ไม่ตอบ ACK หรือ flow ตั้งค่าไม่สมบูรณ์
  return Date.now() - updatedAt.getTime() > WIFI_CONFIGURING_STALE_MS;
};

const buildUnpairedDeviceData = () => ({
  elderId: null,
  status: 'UNPAIRED' as const,
  wifiStatus: 'DISCONNECTED' as const,
});

const publishResetNvsBestEffort = (
  deviceSerial: string,
  reason: 'UNPAIR' | 'ADMIN_FORCE_UNPAIR',
): void => {
  const topic = MQTT_TOPICS.getConfigTopic(deviceSerial);

  // RESET_NVS ส่งแบบ retained เพื่อให้อุปกรณ์ที่กลับมา online ภายหลังยังรับคำสั่งได้
  // ถ้าส่งไม่สำเร็จจะไม่ทำให้ unpair ล้ม เพราะ DB เป็น source of truth แล้ว
  void mqttClient
    .publish(
      topic,
      {
        action: 'RESET_NVS',
        reason,
        deviceSerial,
        requestId: crypto.randomUUID(),
      },
      { retain: true },
    )
    .then(() => {
      log('📤 Sent retained RESET_NVS to %s after %s', deviceSerial, reason.toLowerCase());
    })
    .catch((error) => {
      log(
        '❌ Failed to send retained RESET_NVS to %s after %s: %O',
        deviceSerial,
        reason.toLowerCase(),
        error,
      );
    });
};

const clearRetainedDeviceConfigBestEffort = (deviceSerial: string, reason: string): void => {
  // ล้าง retained command เก่าที่อาจค้างจากรอบ unpair ก่อนหน้า
  // ไฟล์ถัดไป: iot/mqttClient.ts
  void mqttClient
    .clearRetainedConfigCommand(deviceSerial)
    .then(() => {
      log('🧹 Cleared retained config command for %s during %s', deviceSerial, reason);
    })
    .catch((error) => {
      log(
        '⚠️ Failed to clear retained config command for %s during %s: %O',
        deviceSerial,
        reason,
        error,
      );
    });
};

const isInfraAckFailure = (reason: string): boolean => {
  // แยก error จาก infrastructure เช่น timeout/offline ออกจาก error ที่อุปกรณ์ตอบกลับเอง
  return ACK_INFRA_ERROR_HINTS.some((hint) => reason.includes(hint));
};

const updateDeviceWifiStatus = async (deviceId: string, wifiStatus: 'CONFIGURING' | 'ERROR') => {
  await prisma.device.update({
    where: { id: deviceId },
    data: { wifiStatus },
  });
};

const assertElderOwnership = async (elderId: string, userId: string) => {
  // ตรวจว่าผู้ใช้เป็นเจ้าของ elder นี้จริงก่อนให้จัดการอุปกรณ์
  const elder = await prisma.elder.findFirst({
    where: { id: elderId, userId },
  });

  if (!elder) {
    throw createError.accessDenied();
  }
};

async function recoverDeviceConfigIfStale(device: {
  id: string;
  wifiStatus: string;
  updatedAt: Date | null;
}) {
  if (device.wifiStatus !== 'CONFIGURING' || !isStaleConfiguring(device.updatedAt)) {
    return null;
  }

  // ถ้า CONFIGURING ค้างนานเกินไป ให้เปลี่ยนเป็น ERROR เพื่อให้ client ลองใหม่ได้
  return prisma.device.update({
    where: { id: device.id },
    data: {
      wifiStatus: 'ERROR',
      updatedAt: new Date(),
    },
    select: {
      id: true,
      wifiStatus: true,
      updatedAt: true,
    },
  });
}

export const getDeviceByCode = async (deviceCode: string) => {
  // ใช้หลังสแกน QR เพื่อดูว่า deviceCode นี้มีอยู่และยังจับคู่ได้หรือไม่
  const device = await prisma.device.findUnique({
    where: { deviceCode },
    select: {
      id: true,
      deviceCode: true,
      serialNumber: true,
      status: true,
      elderId: true,
      updatedAt: true,
    },
  });

  if (!device) {
    throw createError.deviceNotFound();
  }

  return device;
};

export const pairDevice = async (userId: string, deviceCode: string, elderId: string) => {
  // ตรวจว่า elder ที่จะจับคู่อุปกรณ์เป็นของ user ปัจจุบันจริง
  log(`[PairDevice] Checking ownership: userId=${userId}, elderId=${elderId}`);
  const elder = await prisma.elder.findFirst({
    where: { id: elderId, userId: userId },
  });

  // log เฉพาะข้อมูลที่ไม่ใช่ข้อมูลส่วนตัวของผู้สูงอายุ
  log(`[PairDevice] Elder lookup result: found=%s, elderId=%s`, Boolean(elder), elderId);

  if (!elder) {
    throw createError.accessDenied();
  }

  // หาอุปกรณ์จาก deviceCode ที่ได้จาก QR ไม่ใช่ id ในฐานข้อมูล
  const device = await prisma.device.findUnique({
    where: { deviceCode },
  });

  if (!device) {
    throw createError.deviceNotFound();
  }

  // อุปกรณ์หนึ่งตัวจับคู่กับ elder ได้เพียงคนเดียว
  if (device.elderId) {
    throw createError.deviceAlreadyPaired();
  }

  // elder หนึ่งคนมีอุปกรณ์ได้เพียงหนึ่งตัว
  const elderDevice = await prisma.device.findFirst({
    where: { elderId },
  });

  if (elderDevice) {
    throw createError.deviceAlreadyPaired();
  }

  // ผูก device เข้ากับ elder และเริ่มสถานะ WiFi เป็น DISCONNECTED
  const pairedDevice = await prisma.device.update({
    where: { id: device.id },
    data: {
      elderId,
      status: 'PAIRED',
      wifiStatus: 'DISCONNECTED',
      lastOnline: null,
    },
    include: {
      elder: true,
    },
  });

  // ล้าง retained command เก่าจากรอบ unpair เพื่อไม่ให้ RESET_NVS ข้ามรอบมาชน provisioning ใหม่
  clearRetainedDeviceConfigBestEffort(device.serialNumber, 'pairDevice');

  return pairedDevice;
};

export const unpairDevice = async (userId: string, deviceId: string) => {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    include: { elder: true },
  });

  if (!device) {
    throw createError.deviceNotFound();
  }

  if (!device.elderId) {
    // ถ้าไม่ได้จับคู่อยู่แล้ว ให้คืนข้อมูลเดิมเพื่อให้ API ทำงานแบบ idempotent
    return device;
  }

  // ผู้ใช้ unpair ได้เฉพาะอุปกรณ์ที่ผูกกับ elder ของตัวเอง
  await assertElderOwnership(device.elderId, userId);

  const shouldResetDevice = Boolean(device.serialNumber) && device.status === 'PAIRED';
  const deviceSerial = device.serialNumber || '';

  // อัปเดต DB ก่อน เพราะ DB เป็น source of truth ของ pairing state
  const unpaired = await prisma.device.update({
    where: { id: deviceId },
    data: buildUnpairedDeviceData(),
  });

  if (shouldResetDevice) {
    // สั่งอุปกรณ์ล้าง NVS และกลับเข้าสู่ flow ตั้งค่าใหม่
    publishResetNvsBestEffort(deviceSerial, 'UNPAIR');
  }

  logger.audit('device_unpaired', {
    actorId: userId,
    deviceId,
    serialNumber: device.serialNumber,
    reason: 'USER_UNPAIR',
  });

  return unpaired;
};

export const configureWiFi = async (
  userId: string,
  deviceIdOrCode: string,
  ssid: string,
  password: string,
) => {
  // รองรับทั้ง device.id และ deviceCode เพราะบาง flow เริ่มจาก QR code
  const isUuid = deviceIdOrCode.includes('-');

  const device = await prisma.device.findFirst({
    where: isUuid ? { id: deviceIdOrCode } : { deviceCode: deviceIdOrCode },
  });

  if (!device || !device.elderId) {
    throw createError.deviceNotPaired();
  }

  // ตรวจสิทธิ์ก่อนส่งค่า WiFi ไปยังอุปกรณ์
  const elder = await prisma.elder.findFirst({
    where: { id: device.elderId, userId: userId },
  });

  if (!elder) {
    throw createError.accessDenied();
  }

  // เริ่ม flow provisioning แล้วเปลี่ยนสถานะเป็น CONFIGURING ทันที
  // backend ไม่เก็บ SSID/password ลงฐานข้อมูล
  await updateDeviceWifiStatus(device.id, 'CONFIGURING');

  // ส่งคำสั่งไปยัง topic ของอุปกรณ์ โดย MQTT topic ใช้ serialNumber เป็นตัวอ้างอิง
  const topic = MQTT_TOPICS.getConfigTopic(device.serialNumber);
  const requestId = crypto.randomUUID();
  const ackTimeoutMs = backendEnv.mqttConfigAckTimeoutMs;
  const ackPromise = mqttClient.waitForConfigAck(device.serialNumber, requestId, ackTimeoutMs);

  try {
    await mqttClient.publish(topic, {
      wifiSSID: ssid,
      wifiPassword: password,
      requestId,
    });
  } catch (error) {
    log('❌ Failed to publish WiFi config to %s: %O', device.serialNumber, error);

    mqttClient.cancelConfigAckWait(device.serialNumber, requestId);
    await ackPromise.catch(() => undefined);

    // ส่งคำสั่งไม่ออก ให้จบ flow เป็น ERROR เพื่อให้ client แสดงให้ลองใหม่
    await updateDeviceWifiStatus(device.id, 'ERROR');

    throw createError.serverError();
  }

  let ack;

  try {
    // รอ ACK จาก ESP32 ว่าได้รับคำสั่ง config แล้ว
    ack = await ackPromise;
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : 'Device did not acknowledge WiFi config';
    const isInfraError = isInfraAckFailure(reason);

    log('❌ WiFi config ACK failed for %s: %s', device.serialNumber, reason);

    await updateDeviceWifiStatus(device.id, 'ERROR');

    if (isInfraError) {
      throw createError.validationError(
        'อุปกรณ์ไม่ตอบสนอง กรุณาตรวจสอบว่าอุปกรณ์เปิดอยู่และลองใหม่อีกครั้ง',
      );
    }

    throw createError.validationError(reason);
  }

  const updatedDevice = await prisma.device.update({
    where: { id: device.id },
    data: {
      // ACK หมายถึงอุปกรณ์รับคำสั่งแล้ว ยังไม่ถือว่าเชื่อม WiFi สำเร็จจริง
      // สถานะ online จะถูกยืนยันภายหลังจาก status topic
      wifiStatus: 'CONFIGURING',
      updatedAt: new Date(),
    },
    select: {
      id: true,
      wifiStatus: true,
      updatedAt: true,
    },
  });

  return {
    config: {
      id: updatedDevice.id,
      deviceId: updatedDevice.id,
      wifiStatus: updatedDevice.wifiStatus,
      updatedAt: updatedDevice.updatedAt,
    },
    ack: {
      requestId: ack.requestId,
      timestamp: ack.timestamp,
    },
  };
};

export const getDeviceConfig = async (userId: string, deviceId: string) => {
  const isUuid = deviceId.includes('-');

  const device = await prisma.device.findFirst({
    where: isUuid ? { id: deviceId } : { deviceCode: deviceId },
    include: {
      elder: true,
    },
  });

  if (!device || !device.elderId) {
    throw createError.deviceNotPaired();
  }

  // ผู้ใช้ดู config ได้เฉพาะอุปกรณ์ที่ผูกกับ elder ของตัวเอง
  await assertElderOwnership(device.elderId, userId);

  const recoveredDevice = await recoverDeviceConfigIfStale(device);

  if (recoveredDevice) {
    return {
      id: recoveredDevice.id,
      deviceId: recoveredDevice.id,
      wifiStatus: recoveredDevice.wifiStatus,
      updatedAt: recoveredDevice.updatedAt,
    };
  }

  return {
    id: device.id,
    deviceId: device.id,
    wifiStatus: device.wifiStatus,
    updatedAt: device.updatedAt,
  };
};

// MQTT handlers เรียก helpers เหล่านี้แทนการแตะ prisma โดยตรง

/**
 * โครงสร้างข้อมูล device ที่ fall handlers ต้องการ
 * (fallHandler + fallCancelledHandler ใช้ร่วมกัน)
 */
export interface DeviceForFallHandler {
  readonly id: string;
  readonly elderId: string | null;
  readonly deviceCode: string;
  readonly elder: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
  } | null;
}

/**
 * โครงสร้างข้อมูล device พร้อม domain-validated status
 * ใช้โดย statusHandler เพื่อประมวลผล MQTT status payload
 */
export interface DeviceStatusContext {
  readonly id: string;
  readonly deviceCode: string;
  readonly serialNumber: string;
  readonly status: DeviceStatus;
  readonly wifiStatus: WifiStatus;
  readonly elderId: string | null;
  readonly elder: {
    readonly id: string;
    readonly firstName: string;
    readonly lastName: string;
  } | null;
}

/** ค้นหา device จาก serialNumber (MQTT topic) พร้อมข้อมูล elder สำหรับ fall handlers */
export const findDeviceBySerial = async (
  serialNumber: string,
): Promise<DeviceForFallHandler | null> => {
  return prisma.device.findFirst({
    where: { serialNumber },
    select: {
      id: true,
      elderId: true,
      deviceCode: true,
      elder: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
};

/**
 * ค้นหา device จาก serialNumber พร้อม domain-validate status/wifiStatus
 * คืน null ถ้าไม่พบหรือค่า status ไม่ตรงกับ domain constants
 */
export const findDeviceStatusContext = async (
  serialNumber: string,
): Promise<DeviceStatusContext | null> => {
  // deviceId ใน MQTT topic คือ serialNumber ของ ESP32
  const device = await prisma.device.findFirst({
    where: { serialNumber },
    select: {
      id: true,
      deviceCode: true,
      serialNumber: true,
      status: true,
      wifiStatus: true,
      elderId: true,
      elder: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });

  if (!device) return null;

  // ตรวจค่าจาก DB ให้ตรงกับ domain constants ก่อนนำไปใช้ใน side effect
  if (
    !DEVICE_STATUSES.includes(device.status as DeviceStatus) ||
    !WIFI_STATUSES.includes(device.wifiStatus as WifiStatus)
  ) {
    return null;
  }

  return {
    ...device,
    status: device.status as DeviceStatus,
    wifiStatus: device.wifiStatus as WifiStatus,
  };
};

/** อัปเดต wifiStatus ของอุปกรณ์ที่ถูก unpair แล้วให้เป็น DISCONNECTED */
export const syncUnpairedDeviceOfflineState = async (deviceId: string): Promise<void> => {
  // อุปกรณ์ที่ unpaired แล้วไม่ควรถูกนับว่า connected ใน backend
  await prisma.device.update({
    where: { id: deviceId },
    data: { wifiStatus: 'DISCONNECTED', updatedAt: new Date() },
  });
};

/**
 * อัปเดต lastOnline / wifiStatus ตาม MQTT status payload
 *
 * - online=true  → lastOnline + wifiStatus: CONNECTED (1 query)
 * - online=false + ERROR → อัปเดตเฉพาะ updatedAt ไม่ลด ERROR เป็น DISCONNECTED
 * - online=false + อื่นๆ → wifiStatus: DISCONNECTED
 */
export const updateDeviceConnectivity = async (
  deviceId: string,
  online: boolean,
  serverTimestamp: Date,
  currentWifiStatus: WifiStatus,
): Promise<void> => {
  if (online) {
    // online=true จะอัปเดต lastOnline ด้วย server time เพื่อใช้คำนวณ freshness ฝั่ง API/mobile
    await prisma.device.update({
      where: { id: deviceId },
      data: { lastOnline: serverTimestamp, wifiStatus: 'CONNECTED', updatedAt: serverTimestamp },
    });
    return;
  }

  // ถ้าอยู่ ERROR แล้ว ไม่ลดสถานะเป็น DISCONNECTED ทับทันที เพื่อให้ client ยังเห็นว่าตั้งค่า WiFi มีปัญหา
  if (currentWifiStatus === 'ERROR') {
    await prisma.device.update({
      where: { id: deviceId },
      data: { updatedAt: serverTimestamp },
    });
    return;
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: { wifiStatus: 'DISCONNECTED', updatedAt: serverTimestamp },
  });
};
