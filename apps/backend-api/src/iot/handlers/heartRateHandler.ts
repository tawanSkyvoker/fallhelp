/**
 * heartRateHandler.ts
 *
 * Handler สำหรับ MQTT event ชีพจรจาก ESP32
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - validate heart rate payload จาก MQTT
 * - ค้นหา device และ elder ที่ผูกอยู่
 * - ส่งค่า heart rate ไปยัง mobile ผ่าน Socket.io แบบ realtime
 * - ไม่สร้าง Event หรือ Notification แยกสำหรับ HR
 */

import { validateHeartRatePayload } from '../payloadValidator';

import { findDeviceBySerial } from '../../services/deviceService';
import { socketServer } from '../../realtime/socketServer';

import createDebug from 'debug';

const log = createDebug('fallhelp:mqtt:heartrate');

function emitHeartRateUpdate(
  elderId: string,
  elderName: string,
  deviceId: string,
  deviceCode: string,
  timestamp: Date,
  heartRate: number,
  confidence?: 'none' | 'low' | 'medium' | 'high',
): void {
  // ส่งค่า heart rate ให้ UI แบบ realtime
  // ไฟล์ถัดไป: realtime/socketServer.ts
  socketServer.emitHeartRateUpdate({
    elderId,
    elderName,
    deviceId,
    deviceCode,
    timestamp,
    heartRate,
    ...(confidence !== undefined ? { confidence } : {}),
  });
}

export async function heartRateHandler(deviceId: string, data: unknown): Promise<void> {
  try {
    const payload = validateHeartRatePayload(data);

    if (!payload) {
      log('❌ Invalid heart rate payload from device %s: %O', deviceId, data);
      return;
    }

    log('💓 Heart rate reading for device %s: %d BPM', deviceId, payload.heartRate);

    // deviceId จาก MQTT topic คือ serialNumber ของอุปกรณ์
    // ไฟล์ถัดไป: services/deviceService.ts
    const device = await findDeviceBySerial(deviceId);

    if (!device) {
      log('❌ Device %s not found', deviceId);
      return;
    }

    if (!device.elderId) {
      log('❌ Device %s not paired with any elder', deviceId);
      return;
    }

    const elderName = device.elder
      ? `${device.elder.firstName} ${device.elder.lastName}`
      : 'Unknown';

    // ใช้เวลา server เพราะ timestamp จาก ESP32 มักเป็น millis() ไม่ใช่เวลาจริง
    const serverTimestamp = new Date();

    if (payload.confidence === 'none') {
      // ยัง emit ไปให้ UI เพื่อให้ client ตัดสินใจแสดงสถานะสัญญาณไม่น่าเชื่อถือเอง
      log(
        '🚫 Ignoring abnormal HR for device %s: confidence=none (unreliable signal), bpm=%d',
        deviceId,
        payload.heartRate,
      );

      emitHeartRateUpdate(
        device.elderId,
        elderName,
        device.id,
        device.deviceCode,
        serverTimestamp,
        payload.heartRate,
        payload.confidence,
      );

      return;
    }

    if (payload.heartRate === 0) {
      // heartRate=0 ใช้เป็นสัญญาณให้ mobile เคลียร์ค่าชีพจรที่ค้างอยู่
      log('📤 Emitting heartRate=0 (sensor removed) for device %s', deviceId);

      emitHeartRateUpdate(
        device.elderId,
        elderName,
        device.id,
        device.deviceCode,
        serverTimestamp,
        0,
        payload.confidence,
      );

      return;
    }

    // ส่ง realtime update ทุก reading โดยไม่บันทึกเป็น event แยก
    emitHeartRateUpdate(
      device.elderId,
      elderName,
      device.id,
      device.deviceCode,
      serverTimestamp,
      payload.heartRate,
      payload.confidence,
    );
  } catch (error) {
    // จับ error ระดับ handler เพื่อไม่ให้ MQTT consumer ล้มจาก heart rate message เดียว
    log('❌ Error handling heart rate: %O', error);
  }
}
