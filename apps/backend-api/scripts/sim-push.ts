// sim-push.ts — จำลอง fall event เต็ม pipeline: Event → Notification record → Push Notification
// ─────────────────────────────────────────────────────────────────────────────
// เหมือน MQTT fallHandler ยิงมาจริง ยกเว้น Socket.io emit (ต้องมี server รันอยู่)
//
// รัน: npm run sim:push
// กำหนด BPM เอง: npm run sim:push -- --bpm 120

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { createEvent } from '../src/services/eventService.js';
import { notifyFallDetection } from '../src/services/notificationService.js';

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

async function main() {
  const args = process.argv.slice(2);
  const bpmIdx = args.indexOf('--bpm');
  const bpmArg = bpmIdx !== -1 ? Number(args[bpmIdx + 1]) : null;
  const heartRate = bpmArg && !isNaN(bpmArg) ? bpmArg : Math.floor(Math.random() * 40) + 85; // 85–124

  // ดึง elder + device ที่ผูกกันจริง เพื่อลดเคส findFirst ไปชน elder ที่ยัง setup ไม่ครบ
  const elder = await prisma.elder.findFirst({
    where: {
      device: {
        isNot: null,
      },
    },
    include: {
      device: true,
      user: { select: { pushToken: true } },
    },
  });

  if (!elder) {
    console.error('❌ ไม่พบ Elder ในระบบ');
    process.exit(1);
  }
  if (!elder.device) {
    console.error(`❌ Elder "${elder.firstName}" ยังไม่มีอุปกรณ์ผูกอยู่`);
    process.exit(1);
  }

  console.log(`\n👤 Elder  : ${elder.firstName} ${elder.lastName}`);
  console.log(`📱 Device : ${elder.device.deviceCode}`);
  console.log(`💓 BPM    : ${heartRate}`);
  console.log(`\n⏳ กำลังรัน pipeline...\n`);

  // 1. สร้าง FALL CRITICAL event (fall_confirmed)
  const event = await createEvent({
    elderId: elder.id,
    deviceId: elder.device.id,
    fallStage: 'CONFIRMED',
    bpm: heartRate,
    magnitude: 8.6,
    postureDelta: 51.4,
    timestamp: new Date(),
  });
  console.log(`✅ [1/2] สร้าง FALL event สำเร็จ — ID: ${event.id}`);

  // 2. notifyFallDetection: สร้าง Notification record ในDB + ส่ง Push
  await notifyFallDetection(elder.id, event.id, heartRate);
  console.log(`✅ [2/2] Notification + Push ส่งแล้ว`);

  if (!elder.user?.pushToken) {
    console.log(`\n⚠️  ไม่พบ pushToken — Push ไม่ถึงมือถือ`);
    console.log(`   → เปิดแอปบนมือถือก่อน 1 ครั้ง เพื่อลงทะเบียน token`);
  } else {
    console.log(`\n📲 รอรับ Push Notification บนมือถือได้เลย`);
  }

  console.log(`\n📋 ตรวจสอบ:`);
  console.log(`   - หน้าประวัติเหตุการณ์ → ควรมี event ใหม่ขึ้นมา`);
  console.log(`   - หน้าแจ้งเตือน → ควรมีรายการ "ตรวจพบการล้ม" ใหม่`);
  console.log(`   - Push Notification บนมือถือ\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
