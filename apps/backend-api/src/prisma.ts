/**
 * prisma.ts
 *
 * Singleton Prisma Client สำหรับเชื่อมต่อ PostgreSQL
 *
 * สิ่งที่เกิดขึ้นในไฟล์นี้:
 * - โหลด environment variables ก่อนอ่าน DATABASE_URL
 * - สร้าง pg connection pool จาก DATABASE_URL
 * - ใช้ PrismaPg adapter ให้ Prisma ทำงานผ่าน pg driver
 * - export prisma singleton ให้ service ทั้งระบบใช้ร่วมกัน
 * - มี disconnectPrisma สำหรับ script/test ที่ต้องปิด connection เอง
 */

import 'dotenv/config';

import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

import { backendEnv } from './config/env';

// แยก DATABASE_URL เป็น field ย่อย เพื่อควบคุมค่า connection pool ได้ชัดเจน
const dbUrl = new URL(backendEnv.databaseUrl);

const pool = new pg.Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port, 10),
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: String(dbUrl.password),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});

// ใช้ driver adapter เพื่อให้ Prisma เชื่อมผ่าน pg pool ตัวเดียวกัน
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

export async function disconnectPrisma(): Promise<void> {
  // ใช้สำหรับ test/script ที่ต้องปิด process ให้จบเร็วและไม่ค้าง connection
  await prisma.$disconnect();
  await pool.end();
}

export default prisma;
