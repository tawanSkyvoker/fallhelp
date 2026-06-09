// sim-events.ts — จำลองการส่ง event เข้าฐานข้อมูลสำหรับทดสอบ monthly report + event history
// ─────────────────────────────────────────────────────────────────────────────
// รัน: npm run sim:events
// ล้างของทดสอบ: npm run sim:events -- --clear
//
// สร้าง event ในเดือนปัจจุบัน (เวลาไทย UTC+7):
//   - FALL CRITICAL (fall_confirmed): สถิติชีพจรครบ 3 กลุ่ม
//   - FALL WARNING  (fall_suspected): กระจายช่วงเวลา (peak hour test)
//   - HEART_RATE: ค่าปกติและผิดปกติ

import 'dotenv/config';
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

// ─── ตัวช่วย (Helpers) ────────────────────────────────────────────────────────

// สร้าง timestamp ในเดือนปัจจุบัน (UTC+7) ที่ชั่วโมงและวันที่กำหนด
function thaiTime(day: number, hour: number, minute = 0): Date {
  const now = new Date();
  // สร้าง ISO string ใน timezone ไทยแล้วแปลง
  const isoStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+07:00`;
  return new Date(isoStr);
}

function randomBpm(range: 'high' | 'normal' | 'low'): number {
  if (range === 'high') return Math.floor(Math.random() * 40) + 101; // 101–140
  if (range === 'low') return Math.floor(Math.random() * 20) + 40; // 40–59
  return Math.floor(Math.random() * 41) + 60; // 60–100
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const isClear = process.argv.includes('--clear');

  // ดึง elder + device คู่แรกที่ผูกกันจริง เพื่อลดเคสชน elder ที่ยังไม่มีอุปกรณ์
  const elder = await prisma.elder.findFirst({
    where: {
      device: {
        isNot: null,
      },
    },
    include: { device: true },
  });

  if (!elder) {
    console.error('❌ ไม่พบข้อมูล Elder ในระบบ — กรุณาสร้าง Elder ผ่าน Setup Wizard ก่อน');
    process.exit(1);
  }
  if (!elder.device) {
    console.error(`❌ Elder "${elder.firstName} ${elder.lastName}" ยังไม่มีอุปกรณ์ผูกอยู่`);
    process.exit(1);
  }

  const elderId = elder.id;
  const deviceId = elder.device.id;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  console.log(`\n👤 Elder: ${elder.firstName} ${elder.lastName} (${elderId})`);
  console.log(`📱 Device: ${elder.device.deviceCode} (${deviceId})`);
  console.log(`📅 เดือน: ${month}/${year} (UTC+7)\n`);

  // ─── โหมดล้างข้อมูลทดสอบ ───────────────────────────────────────────────
  if (isClear) {
    const startDate = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+07:00`);
    const endDate = new Date(
      `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}T23:59:59+07:00`,
    );

    const deleted = await prisma.event.deleteMany({
      where: { elderId, timestamp: { gte: startDate, lte: endDate } },
    });
    console.log(`🗑️  ลบ ${deleted.count} event ในเดือน ${month}/${year} เรียบร้อยแล้ว`);
    return;
  }

  // ─── สร้าง FALL events จำลอง ───────────────────────────────────────────

  // กลุ่มที่ 1: FALL CRITICAL (fall_confirmed) — ชีพจรสูง 3 ครั้ง
  const highHrEvents = [
    { day: 3, hour: 2, bpm: randomBpm('high') },
    { day: 8, hour: 3, bpm: randomBpm('high') },
    { day: 15, hour: 2, bpm: randomBpm('high') },
  ];

  // กลุ่มที่ 2: FALL CRITICAL (fall_confirmed) — ชีพจรปกติ 2 ครั้ง
  const normalHrEvents = [
    { day: 5, hour: 14, bpm: randomBpm('normal') },
    { day: 20, hour: 9, bpm: randomBpm('normal') },
  ];

  // กลุ่มที่ 3: FALL CRITICAL (fall_confirmed) — ชีพจรต่ำ 1 ครั้ง
  const lowHrEvents = [{ day: 12, hour: 22, bpm: randomBpm('low') }];

  // กลุ่มที่ 4: FALL WARNING (fall_suspected) — ยังไม่ confirm (ไม่นับใน monthly)
  // กระจายหลายชั่วโมงเพื่อทดสอบ peak hour = 02:xx
  const suspectedEvents = [
    { day: 2, hour: 2 },
    { day: 7, hour: 2 },
    { day: 10, hour: 14 },
    { day: 18, hour: 9 },
  ];

  let created = 0;

  // สร้าง CRITICAL events (นับใน monthly summary)
  for (const e of [...highHrEvents, ...normalHrEvents, ...lowHrEvents]) {
    await prisma.event.create({
      data: {
        elderId,
        deviceId,
        fallStage: 'CONFIRMED',
        bpm: e.bpm,
        magnitude: 8.6,
        postureDelta: 51.4,
        timestamp: thaiTime(e.day, e.hour),
      },
    });
    created++;
  }

  // สร้าง WARNING events (ไม่นับใน monthly summary แต่แสดงในประวัติ)
  for (const e of suspectedEvents) {
    await prisma.event.create({
      data: {
        elderId,
        deviceId,
        fallStage: 'PENDING_CONFIRMATION',
        magnitude: 8.6,
        postureDelta: 51.4,
        timestamp: thaiTime(e.day, e.hour),
      },
    });
    created++;
  }

  console.log(`✅ สร้างสำเร็จ ${created} events\n`);
  console.log('📊 สรุปที่ควรเห็นใน Monthly Report:');
  console.log(
    `   เหตุการณ์หกล้ม (CRITICAL): ${highHrEvents.length + normalHrEvents.length + lowHrEvents.length} ครั้ง`,
  );
  console.log(`   ชีพจรสูง  (>100): ${highHrEvents.length} ครั้ง`);
  console.log(`   ชีพจรปกติ (60-100): ${normalHrEvents.length} ครั้ง`);
  console.log(`   ชีพจรต่ำ  (<60):  ${lowHrEvents.length} ครั้ง`);
  console.log(`   Peak hour ที่ควรได้: 02:00-03:00 น. (CRITICAL ที่ชั่วโมง 02 = 3 ครั้ง)`);
  console.log(`\n📋 Event ใน History (รวม WARNING): ${created} รายการ`);
  console.log('\n💡 ล้างข้อมูลทดสอบ: npm run sim:events -- --clear\n');
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
