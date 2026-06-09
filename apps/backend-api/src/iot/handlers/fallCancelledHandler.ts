/**
 * fallCancelledHandler.ts
 *
 * Handler สำหรับ MQTT event ยกเลิกการล้มจากอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - รับ fall_cancelled จาก MQTT
 * - ค้นหา device และ elder ที่ผูกอยู่ผ่าน deviceService
 * - ยกเลิก pending fall event ล่าสุดผ่าน eventService
 * - emit FALL_CANCELLED เป็น internal lifecycle signal ให้ mobile clear pending guard
 */

import { cancelFallEventByDevice } from '../../services/eventService';
import { findDeviceBySerial } from '../../services/deviceService';
import { socketServer } from '../../realtime/socketServer';

import createDebug from 'debug';

const log = createDebug('fallhelp:mqtt:fall-cancelled');

export async function fallCancelledHandler(deviceId: string): Promise<void> {
  try {
    log('🟢 Fall cancelled by device %s', deviceId);

    // ค้นหาอุปกรณ์จาก serialNumber ที่มากับ MQTT topic
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

    // ยกเลิกได้เฉพาะ pending event ที่ยังอยู่ในช่วง cancel ที่ถูกต้อง
    // ไฟล์ถัดไป: services/eventService.ts
    const cancelled = await cancelFallEventByDevice(device.id);

    if (!cancelled) {
      log('⚠️ No recent fall event to cancel for device %s', deviceId);
      return;
    }

    // ส่ง lifecycle signal ให้ mobile clear pending guard และคง Dashboard เป็น NORMAL
    // ใช้เวลาปัจจุบันเป็นเวลาที่ backend emit cancellation signal
    // ไฟล์ถัดไป: realtime/socketServer.ts
    socketServer.emitEventStatusChanged({
      eventId: cancelled.id,
      elderId: device.elderId,
      deviceId: device.id,
      deviceCode: device.deviceCode,
      status: 'FALL_CANCELLED',
      timestamp: new Date(),
    });

    log('✅ Fall event cancelled for device %s (eventId=%s)', deviceId, cancelled.id);
    log('✅ Fall cancellation lifecycle emitted for device %s', deviceId);
  } catch (error) {
    // จับ error ระดับ handler เพื่อไม่ให้ MQTT consumer ล้มจาก message เดียว
    log('❌ Error handling fall cancellation: %O', error);
  }
}
