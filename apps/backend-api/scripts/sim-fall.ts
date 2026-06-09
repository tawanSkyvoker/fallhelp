// sim-fall.ts — จำลอง fall pipeline ผ่าน MQTT รองรับทั้งมีและไม่มีฮาร์ดแวร์
// ─────────────────────────────────────────────────────────────────────────────
//
// โหมด 1 — ไม่มีฮาร์ดแวร์ (default):
//   จำลองพฤติกรรม ESP32 โดยส่ง MQTT events ตรงไปหา broker เอง
//   → suspected_fall → รอ cancel window → fall_confirmed
//   ✅ ไม่ต้องมีอุปกรณ์จริง แต่ต้องมี backend server + MQTT broker รันอยู่
//
// โหมด 2 — มีฮาร์ดแวร์ (--hardware):
//   ส่ง cmd: "sim_fall" ไปหา ESP32 แล้วให้ firmware จัดการ 2-stage เอง
//   ✅ ต้องมี ESP32 online + MQTT broker
//
// รัน (ไม่มีฮาร์ดแวร์): npm run sim:fall
// รัน (มีฮาร์ดแวร์)    : npm run sim:fall -- --hardware
// เร่งเวลา            : npm run sim:fall -- --fast          (cancel window 3 วิ)
// โหมดยกเลิก          : npm run sim:fall -- --cancel        (จำลองกดปุ่มยกเลิก)
// กำหนดเอง           : npm run sim:fall -- --timeout 8
// กำหนด BPM          : npm run sim:fall -- --bpm 120
// ระบุ serial         : npm run sim:fall -- --serial ESP32-XXXXXXXXXXXX

import 'dotenv/config';
import { connect, type MqttClient } from 'mqtt';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

// ─── Prisma Setup ─────────────────────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error('DATABASE_URL is not set');
const dbUrl = new URL(DATABASE_URL);
const pool = new pg.Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port),
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: String(dbUrl.password),
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const DEVICE_CANCEL_WINDOW_SEC = 15;

// ─── ตัวช่วย ─────────────────────────────────────────────────────────────────

async function countdown(seconds: number): Promise<void> {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r   ⏱  Cancel window: ${i}s เหลืออยู่... `);
    await new Promise((r) => setTimeout(r, 1000));
  }
  process.stdout.write('\r   ✅ Cancel window หมดเวลา              \n');
}

function publish(client: MqttClient, topic: string, payload: object): Promise<void> {
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function subscribe(client: MqttClient, topic: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function waitForHardwareLifecycle(
  client: MqttClient,
  serialNumber: string,
  waitSeconds: number,
): Promise<void> {
  const topic = `device/${serialNumber}/event`;
  const lifecycleEvents: string[] = [];

  await subscribe(client, topic);
  console.log(`👂 กำลังฟัง event จากอุปกรณ์ที่ ${topic}`);
  console.log(`⏱  รอ cancel window ${waitSeconds}s เหมือนอุปกรณ์จริง...\n`);

  const onMessage = (receivedTopic: string, message: Buffer) => {
    if (receivedTopic !== topic) return;

    try {
      const payload = JSON.parse(message.toString()) as { type?: string; state?: string };
      const eventType = payload.type ?? payload.state ?? 'unknown';
      const now = new Date().toLocaleTimeString('th-TH', { hour12: false });
      lifecycleEvents.push(eventType);
      console.log(`📩 [${now}] ${eventType}`);
    } catch {
      console.log(`📩 event: ${message.toString()}`);
    }
  };

  client.on('message', onMessage);

  try {
    await countdown(waitSeconds);
    await new Promise((resolve) => setTimeout(resolve, 2500));
  } finally {
    client.off('message', onMessage);
  }

  if (lifecycleEvents.length === 0) {
    console.log('⚠️  ยังไม่เห็น lifecycle event กลับมาจากอุปกรณ์');
    return;
  }

  console.log('\n📋 Lifecycle ที่รับได้จากอุปกรณ์:');
  lifecycleEvents.forEach((eventType, index) => {
    console.log(`   ${index + 1}. ${eventType}`);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  const isHardware = args.includes('--hardware');
  const isFast = args.includes('--fast');
  const isCancel = args.includes('--cancel');
  const serialIdx = args.indexOf('--serial');
  const serialOverride = serialIdx !== -1 ? (args[serialIdx + 1] ?? null) : null;
  const timeoutIdx = args.indexOf('--timeout');
  const bpmIdx = args.indexOf('--bpm');
  const bpmArg = bpmIdx !== -1 ? Number(args[bpmIdx + 1]) : null;
  const cancelTimeoutSec = isFast
    ? 3
    : timeoutIdx !== -1
      ? Number(args[timeoutIdx + 1]) || DEVICE_CANCEL_WINDOW_SEC
      : DEVICE_CANCEL_WINDOW_SEC;
  const simulatedBpm =
    bpmArg !== null && !Number.isNaN(bpmArg) && bpmArg >= 0 ? Math.round(bpmArg) : 112;
  const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
  const mqttUsername = process.env.MQTT_USERNAME || '';
  const mqttPassword = process.env.MQTT_PASSWORD || '';

  // ─── หา serialNumber จาก DB ──────────────────────────────────────────────
  let serialNumber: string;

  if (serialOverride) {
    serialNumber = serialOverride;
    console.log(`\n📟 Serial  : ${serialNumber} (จาก --serial flag)`);
  } else {
    const elder = await prisma.elder.findFirst({
      where: {
        device: {
          isNot: null,
        },
      },
      include: { device: true },
    });

    if (!elder) {
      console.error('❌ ไม่พบ Elder ในระบบ');
      process.exit(1);
    }
    if (!elder.device) {
      console.error(`❌ Elder "${elder.firstName}" ยังไม่มีอุปกรณ์ผูกอยู่`);
      process.exit(1);
    }

    serialNumber = elder.device.serialNumber;
    console.log(`\n👤 Elder   : ${elder.firstName} ${elder.lastName}`);
    console.log(`📱 Device  : ${elder.device.deviceCode} (serial: ${serialNumber})`);
  }

  console.log(`🌐 Broker  : ${brokerUrl}`);
  console.log(
    `🔧 โหมด    : ${isHardware ? 'Hardware (→ ESP32)' : 'No-hardware (→ broker โดยตรง)'}`,
  );
  if (!isHardware) {
    console.log(`⏱  Timeout : ${cancelTimeoutSec}s${isFast ? ' (--fast mode)' : ''}`);
    console.log(`💓 BPM     : ${simulatedBpm}`);
    if (isCancel) {
      console.log(`🛑 โหมด     : จำลองการยกเลิก (Cancel Mode)`);
    }
  }
  console.log('');

  // ─── เชื่อมต่อ MQTT ────────────────────────────────────────────────────────
  const client = connect(brokerUrl, {
    ...(mqttUsername ? { username: mqttUsername } : {}),
    ...(mqttPassword ? { password: mqttPassword } : {}),
    reconnectPeriod: 0,
    connectTimeout: 8000,
  });

  await new Promise<void>((resolve, reject) => {
    client.on('error', reject);
    client.on('connect', () => resolve());
  });

  // ─── โหมด Hardware: ส่ง cmd ไปหา ESP32 ──────────────────────────────────
  if (isHardware) {
    const topic = `device/${serialNumber}/cmd`;
    await publish(client, topic, { cmd: 'sim_fall' });
    console.log(`✅ ส่ง sim_fall cmd ไปยัง ESP32 แล้ว`);
    console.log(`   → ESP32 จะจัดการ 2-stage pipeline เอง`);
    console.log(`   → cancel window ฝั่งอุปกรณ์จริง = ${DEVICE_CANCEL_WINDOW_SEC}s`);
    console.log('');
    await waitForHardwareLifecycle(client, serialNumber, DEVICE_CANCEL_WINDOW_SEC);
    console.log('\n📋 ตรวจสอบ:');
    console.log('   - หน้าประวัติเหตุการณ์ → ควรมี FALL event ใหม่ขึ้นมา');
    console.log('   - หน้าแจ้งเตือน → ควรมีรายการ "ตรวจพบการล้ม" ใหม่');
    console.log('   - Push Notification บนมือถือ\n');
    client.end(false);
    return;
  }

  // ─── โหมด No-hardware: จำลอง 2-stage pipeline ────────────────────────────
  const topic = `device/${serialNumber}/event`;
  const fallEvidence = { magnitude: 8.6, postureDelta: 51.4 };

  // Stage 1: suspected_fall
  console.log('📡 [1/2] ส่ง suspected_fall...');
  await publish(client, topic, {
    type: 'suspected_fall',
    ...fallEvidence,
    bpm: simulatedBpm,
    timestamp: Date.now(),
  });
  console.log('   → WARNING event ถูกสร้างในฐานข้อมูล');
  
  if (isCancel) {
    const cancelWait = isFast ? 1 : 3;
    console.log(`\n⏳ รอจำลองคนกดปุ่มยกเลิก ${cancelWait} วินาที...\n`);
    await countdown(cancelWait);
    
    // Stage 2: fall_cancelled
    console.log('\n📡 [2/2] ส่ง fall_cancelled...');
    await publish(client, topic, {
      type: 'fall_cancelled',
      timestamp: Date.now(),
    });
    console.log('   → Event เปลี่ยนสถานะเป็น CANCELLED');
    console.log('   → หน้าจอ Mobile จะเอา Alert ออก');
    
    client.end(false);
    console.log('\n📋 ตรวจสอบ:');
    console.log('   - หน้าประวัติเหตุการณ์ → Event ควรเปลี่ยนสถานะเป็น ยกเลิก (Cancelled)');
    console.log('   - หน้าจอ Mobile → ไม่ควรมีการแจ้งเตือนค้างอยู่');
    console.log('   - ไม่มี Push Notification แจ้งเตือน Fall\n');
    return;
  }

  console.log(`\n⏳ รอ Cancel window ${cancelTimeoutSec} วินาที...\n`);

  await countdown(cancelTimeoutSec);

  // Stage 2: fall_confirmed
  console.log('\n📡 [2/2] ส่ง fall_confirmed...');
  await publish(client, topic, {
    type: 'fall_confirmed',
    ...fallEvidence,
    bpm: simulatedBpm,
    timestamp: Date.now(),
  });
  console.log('   → CRITICAL event + Push Notification');

  client.end(false);

  console.log('\n📋 ตรวจสอบ:');
  console.log('   - หน้าประวัติเหตุการณ์ → ควรมี FALL event ใหม่ขึ้นมา');
  console.log('   - หน้าแจ้งเตือน → ควรมีรายการ "ตรวจพบการล้ม" ใหม่');
  console.log('   - Push Notification บนมือถือ\n');
}

main()
  .catch((e) => {
    console.error('❌', (e as Error).message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
