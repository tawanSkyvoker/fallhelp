/**
 * statusHandler.ts
 *
 * Handler สำหรับ MQTT event สถานะอุปกรณ์
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - validate status payload จาก ESP32
 * - ค้นหา device context ผ่าน deviceService
 * - ส่ง RESET_NVS ถ้าอุปกรณ์ที่ถูก unpair แล้วยังสื่อสารกลับมา
 * - อัปเดต connectivity ผ่าน deviceService
 * - emit device status ไปยัง mobile ผ่าน Socket.io
 */

import { validateStatusPayload } from '../payloadValidator';
import { DeviceStatusPayload } from '../topics';

import {
  findDeviceStatusContext,
  syncUnpairedDeviceOfflineState,
  updateDeviceConnectivity,
  DeviceStatusContext,
} from '../../services/deviceService';
import { socketServer } from '../../realtime/socketServer';
import { mqttClient } from '../mqttClient';
import { MQTT_TOPICS } from '../topics';

import createDebug from 'debug';
import crypto from 'crypto';

const log = createDebug('fallhelp:mqtt:status');

function emitUnpairedDeviceOffline(device: DeviceStatusContext): void {
  if (!device.elderId || !device.elder) {
    return;
  }

  // sync UI ให้เห็นว่า device นี้ offline หลังถูก unpair
  socketServer.emitDeviceStatusUpdate({
    deviceId: device.id,
    deviceCode: device.deviceCode,
    elderId: device.elderId,
    elderName: `${device.elder.firstName} ${device.elder.lastName}`,
    online: false,
    timestamp: new Date(),
  });
}

async function handleUnpairedDeviceStatus(
  deviceId: string,
  device: DeviceStatusContext,
): Promise<void> {
  log(
    '🚫 UNPAIRED device %s communicating → sending RESET_NVS to force factory reset & BLE mode',
    deviceId,
  );

  // ถ้าอุปกรณ์ที่ถูก unpair แล้วยังส่ง status มา ให้สั่ง reset NVS กลับไปแบบ retained
  void mqttClient
    .publish(
      MQTT_TOPICS.getConfigTopic(deviceId),
      {
        action: 'RESET_NVS',
        reason: 'DEVICE_UNPAIRED',
        deviceSerial: deviceId,
        requestId: crypto.randomUUID(),
      },
      { retain: true },
    )
    .then(() => {
      log('📤 Retained RESET_NVS sent to unpaired device %s', deviceId);
    })
    .catch((err) => {
      log('⚠️ Failed to send retained RESET_NVS to unpaired device %s: %O', deviceId, err);
    });

  // ไฟล์ถัดไป: services/deviceService.ts
  await syncUnpairedDeviceOfflineState(device.id);
  emitUnpairedDeviceOffline(device);
}

function emitPairedDeviceStatus(
  deviceId: string,
  device: DeviceStatusContext,
  payload: DeviceStatusPayload,
  serverTimestamp: Date,
): void {
  if (!device.elderId || !device.elder) {
    return;
  }

  const elderName = `${device.elder.firstName} ${device.elder.lastName}`;

  const deviceRealityCheck = {
    deviceId: device.id,
    deviceCode: device.deviceCode,
    elderId: device.elderId,
    elderName,
    online: payload.online,
    timestamp: serverTimestamp,
    source: 'mqtt_status_update',
    serverTimestamp: serverTimestamp.toISOString(),
    deviceTimestamp: typeof payload.timestamp === 'number' ? payload.timestamp : null,
    ...(payload.signalStrength !== undefined ? { signalStrength: payload.signalStrength } : {}),
    ...(payload.wifiSSID !== undefined ? { wifiSSID: payload.wifiSSID } : {}),
  };

  log(
    '📊 Device reality check for %s: online=%s, signalStrength=%s',
    deviceId,
    payload.online,
    payload.signalStrength,
  );

  // emit ให้ mobile ใช้อัปเดตสถานะ online/offline และ signal แบบ realtime
  // ไฟล์ถัดไป: realtime/socketServer.ts
  socketServer.emitDeviceStatusUpdate(deviceRealityCheck);
}

export async function statusHandler(deviceId: string, data: unknown): Promise<void> {
  try {
    const payload = validateStatusPayload(data);

    if (!payload) {
      log('❌ Invalid status payload from device %s: %O', deviceId, data);
      return;
    }

    log('📊 Device status update for %s: %O', deviceId, payload);

    // ไฟล์ถัดไป: services/deviceService.ts
    const device = await findDeviceStatusContext(deviceId);

    if (!device) {
      log('❌ Device %s not found', deviceId);
      return;
    }

    if (device.status === 'UNPAIRED') {
      await handleUnpairedDeviceStatus(deviceId, device);
      return;
    }

    const serverTimestamp = new Date();

    // ไฟล์ถัดไป: services/deviceService.ts
    await updateDeviceConnectivity(device.id, payload.online, serverTimestamp, device.wifiStatus);

    emitPairedDeviceStatus(deviceId, device, payload, serverTimestamp);

    log('✅ Device status updated for %s', deviceId);
  } catch (error) {
    // จับ error ระดับ handler เพื่อไม่ให้ MQTT consumer ล้มจาก status message เดียว
    log('❌ Error handling device status: %O', error);
  }
}
