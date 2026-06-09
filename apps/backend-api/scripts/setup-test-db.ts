import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Client } from 'pg';

const TEST_DATABASE_NAME = 'fallhelp_test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const prismaMigrationsDir = path.resolve(backendRoot, 'prisma', 'migrations');
const SUPERSEDED_TEST_MIGRATIONS = new Set(['20260402031035_init']);

interface MigrationFile {
  readonly name: string;
  readonly sql: string;
}

function deriveDatabaseUrl(baseUrl: string, databaseName: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${databaseName}`;
  return url.toString();
}

function escapeIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function loadMigrationFiles(): Promise<readonly MigrationFile[]> {
  const entries = await readdir(prismaMigrationsDir, { withFileTypes: true });

  const migrationDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    // migration นี้เป็น initial snapshot เก่าที่ถูกแทนด้วย 20260413081604_init
    // ถ้า replay ทั้งคู่บน test DB ใหม่ จะชน CREATE TABLE users ซ้ำ
    .filter((migrationName) => !SUPERSEDED_TEST_MIGRATIONS.has(migrationName))
    .sort((left, right) => left.localeCompare(right));

  const migrations = await Promise.all(
    migrationDirs.map(async (migrationName) => {
      const migrationPath = path.resolve(prismaMigrationsDir, migrationName, 'migration.sql');
      const sql = await readFile(migrationPath, 'utf8');

      return { name: migrationName, sql };
    }),
  );

  if (migrations.length === 0) {
    throw new Error('ไม่พบ Prisma migrations สำหรับเตรียมฐานข้อมูลทดสอบ');
  }

  return migrations;
}

async function ensureTestDatabaseExists(adminUrl: string, databaseName: string): Promise<void> {
  const client = new Client({ connectionString: adminUrl });

  await client.connect();

  try {
    const result = await client.query<{ exists: boolean }>(
      'SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = $1) AS "exists"',
      [databaseName],
    );

    if (!result.rows[0]?.exists) {
      await client.query(`CREATE DATABASE ${escapeIdentifier(databaseName)}`);
      console.log(`[test-db] created database ${databaseName}`);
      return;
    }

    console.log(`[test-db] database ${databaseName} already exists`);
  } finally {
    await client.end();
  }
}

async function recreatePublicSchema(testUrl: string): Promise<void> {
  const client = new Client({ connectionString: testUrl });

  await client.connect();

  try {
    // integration tests ต้องได้ schema ที่ deterministic ทุกครั้ง จึง recreate public schema ก่อน apply migrations
    await client.query('DROP SCHEMA IF EXISTS public CASCADE');
    await client.query('CREATE SCHEMA public');
    console.log('[test-db] recreated public schema');
  } finally {
    await client.end();
  }
}

async function applyMigrations(
  testUrl: string,
  migrations: readonly MigrationFile[],
): Promise<void> {
  const client = new Client({ connectionString: testUrl });

  await client.connect();

  try {
    for (const migration of migrations) {
      await client.query('BEGIN');

      try {
        await client.query(migration.sql);
        await client.query('COMMIT');
        console.log(`[test-db] applied migration ${migration.name}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(
          `apply migration failed (${migration.name}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  dotenv.config({ path: path.resolve(backendRoot, '.env') });

  const devDatabaseUrl = process.env.DATABASE_URL;

  if (!devDatabaseUrl) {
    throw new Error('ไม่พบ DATABASE_URL ใน apps/backend-api/.env');
  }

  const testDatabaseUrl = deriveDatabaseUrl(devDatabaseUrl, TEST_DATABASE_NAME);
  const adminDatabaseUrl = deriveDatabaseUrl(devDatabaseUrl, 'postgres');
  const mode = process.argv.includes('--reset') ? 'reset' : 'setup';

  console.log(`[test-db] mode=${mode}`);
  console.log(`[test-db] target database=${TEST_DATABASE_NAME}`);

  const migrations = await loadMigrationFiles();

  await ensureTestDatabaseExists(adminDatabaseUrl, TEST_DATABASE_NAME);
  await recreatePublicSchema(testDatabaseUrl);
  await applyMigrations(testDatabaseUrl, migrations);

  console.log('[test-db] ready for integration tests');
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[test-db] failed: ${message}`);
  process.exitCode = 1;
});
