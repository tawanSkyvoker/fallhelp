/**
 * Prisma Seed Script - Admin Account Seeder
 *
 * สร้าง Admin Account สำหรับ FallHelp System
 * รันด้วย: npx prisma db seed
 *
 * ⚠️ ต้องตั้งค่า Environment Variables ใน .env ก่อนรัน:
 *    ADMIN_EMAIL=admin@fallhelp.com
 *    ADMIN_PASSWORD=YourSecurePassword123!
 */

import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import bcrypt from 'bcryptjs';

// ============ SETUP PRISMA WITH DRIVER ADAPTER ============
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not defined in environment variables');
}

const dbUrl = new URL(databaseUrl);

const pool = new pg.Pool({
  host: dbUrl.hostname,
  port: parseInt(dbUrl.port),
  database: dbUrl.pathname.slice(1),
  user: dbUrl.username,
  password: String(dbUrl.password),
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ============ READ FROM ENVIRONMENT ============
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_FIRST_NAME = process.env.ADMIN_FIRST_NAME || 'System';
const ADMIN_LAST_NAME = process.env.ADMIN_LAST_NAME || 'Admin';
// ===============================================

async function main(): Promise<void> {
  console.log('🌱 Starting Admin seed...\n');

  // Validate environment variables
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    console.error('❌ Error: Missing required environment variables!');
    console.error('');
    console.error('Please add the following to your .env file:');
    console.error('  ADMIN_EMAIL=admin@fallhelp.com');
    console.error('  ADMIN_PASSWORD=YourSecurePassword123!');
    console.error('');
    throw new Error('Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env');
  }

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (existingAdmin) {
    console.log(`⏭️  Admin "${ADMIN_EMAIL}" already exists, skipping...`);
    console.log('\n✅ Seed completed (no changes)');
    return;
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

  // Create admin user
  const newAdmin = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      firstName: ADMIN_FIRST_NAME,
      lastName: ADMIN_LAST_NAME,
      role: 'ADMIN',
    },
  });

  console.log(`✅ Created admin: ${newAdmin.email}`);
  console.log('\n🎉 Seed completed!');
  console.log('\n📝 Admin Credentials:');
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log('   Password: (from .env ADMIN_PASSWORD)');
}

main()
  .catch((e: unknown) => {
    console.error('❌ Seed failed:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
