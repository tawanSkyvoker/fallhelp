/**
 * server.ts
 *
 * จุดเริ่มต้นของ backend FallHelp
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลด environment variables ตั้งแต่ต้น process
 * - ตรวจสอบ config สำคัญก่อนเริ่ม server
 * - สร้าง HTTP server จาก Express app
 * - bootstrap Socket.io, MQTT และ schedulers
 * - จัดการ graceful shutdown เมื่อ process ถูกหยุด
 */

import 'dotenv/config';

import http from 'http';
import createDebug from 'debug';

import app from './app';
import prisma from './prisma';
import { socketServer } from './realtime/socketServer';
import { mqttClient } from './iot/mqttClient';
import { validateAndLogConfig } from './utils/configValidator';
import { initSchedulers } from './schedulers/otpScheduler';
import { backendEnv } from './config/env';

// ตรวจ config ก่อน start จริง เพื่อกันระบบขึ้นไม่ครบแล้วพังทีหลัง
validateAndLogConfig(backendEnv.raw);

const PORT = backendEnv.port;
const log = createDebug('fallhelp:server');
const logIo = createDebug('fallhelp:socket');
const logMqtt = createDebug('fallhelp:mqtt');
const logApi = createDebug('fallhelp:api');

const server = http.createServer(app);

log('Starting HTTP server...');

// เปิด Socket.io ก่อนเริ่มรับ client connection
// ไฟล์ถัดไป: realtime/socketServer.ts
socketServer.initialize(server);
logIo('Socket.io initialized');

/* istanbul ignore next */
process.on('SIGTERM', async () => {
  log('SIGTERM received, closing server...');

  socketServer.close();
  logIo('Socket.io server closed');

  await mqttClient.disconnect();
  logMqtt('MQTT Client disconnected');

  await prisma.$disconnect();

  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});

/* istanbul ignore next */
process.on('SIGINT', async () => {
  log('SIGINT received, closing server...');

  socketServer.close();
  logIo('Socket.io server closed');

  await mqttClient.disconnect();
  logMqtt('MQTT Client disconnected');

  await prisma.$disconnect();

  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
});

/* istanbul ignore next */
server.listen(PORT, async () => {
  log(`Backend listening on port ${PORT}`);
  logApi(`API: http://localhost:${PORT}/api`);
  logApi(`Health: http://localhost:${PORT}/internal/health`);
  logIo('Socket.io initialized (awaiting client connections)');

  if (backendEnv.mqttDisabled) {
    logMqtt('🚫 MQTT disabled by config (MQTT_DISABLED=true)');
  } else {
    try {
      // MQTT เป็น service เสริมของ IoT ถ้าเชื่อมไม่ได้ API หลักยังควรทำงานต่อ
      // ไฟล์ถัดไป: iot/mqttClient.ts
      logMqtt('🔌 Connecting to MQTT broker...');
      await mqttClient.connect();
    } catch {
      logMqtt('⚠️ MQTT broker not available - IoT features disabled');
      logMqtt('ℹ️ To enable IoT, start a broker and set MQTT_BROKER_URL or unset MQTT_DISABLED');
    }
  }

  // เริ่มงานตามเวลาหลังระบบหลัก bootstrap เสร็จ
  // ไฟล์ถัดไป: schedulers/otpScheduler.ts
  initSchedulers();
});
