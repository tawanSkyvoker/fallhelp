/**
 * Integration Test — Framework Setup
 *
 * Runs as `setupFilesAfterEnv` (jest globals are available).
 * In ESM mode, we must import jest globals explicitly.
 */

import { jest, afterAll, beforeAll } from '@jest/globals';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { URL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

jest.setTimeout(60000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../../../');
const migrationsRoot = path.resolve(backendRoot, 'prisma/migrations');
const preparedMarkerPath = '/tmp/fallhelp-test-db-prepared';
const SUPERSEDED_TEST_MIGRATIONS = new Set(['20260402031035_init']);

let prepared = false;

const quoteIdent = (value: string) => `"${value.replace(/"/g, '""')}"`;

const decode = (value: string): string => decodeURIComponent(value);

const buildPgEnv = (databaseUrl: URL, databaseName: string) => ({
  ...process.env,
  PGHOST: databaseUrl.hostname,
  PGPORT: databaseUrl.port || '5432',
  PGUSER: decode(databaseUrl.username),
  PGPASSWORD: decode(databaseUrl.password),
  PGDATABASE: databaseName,
});

const applySqlFile = (databaseUrl: URL, databaseName: string, filePath: string): void => {
  const result = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-f', filePath], {
    cwd: backendRoot,
    env: buildPgEnv(databaseUrl, databaseName),
    encoding: 'utf8',
    shell: false,
  });

  if (result.status !== 0) {
    const details = [
      `migration file: ${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`,
      result.error ? `spawn error: ${result.error.message}` : '',
      typeof result.status === 'number' ? `exit status: ${result.status}` : '',
      result.signal ? `signal: ${result.signal}` : '',
      result.stdout,
      result.stderr,
    ]
      .filter(Boolean)
      .join('\n');
    throw new Error(`Failed to apply integration database migration.\n${details}`);
  }
};

const applySqlMigrations = (databaseUrl: URL, databaseName: string): void => {
  const migrationFiles = fs
    .readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    // migration นี้เป็น initial snapshot เก่าที่ถูกแทนด้วย 20260413081604_init
    // ถ้า replay ทั้งคู่บน test DB ใหม่ จะชน CREATE TABLE users ซ้ำ
    .filter((entry) => !SUPERSEDED_TEST_MIGRATIONS.has(entry.name))
    .map((entry) => path.join(migrationsRoot, entry.name, 'migration.sql'))
    .filter((filePath) => fs.existsSync(filePath))
    .sort();

  for (const filePath of migrationFiles) {
    applySqlFile(databaseUrl, databaseName, filePath);
  }
};

const testSchemaReady = async (databaseUrl: URL): Promise<boolean> => {
  const client = new Client({ connectionString: databaseUrl.toString() });
  await client.connect();
  try {
    const result = await client.query<{
      has_bpm: boolean;
      has_value: boolean;
    }>(`
      SELECT
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'events'
            AND column_name = 'bpm'
        ) AS has_bpm,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'events'
            AND column_name = 'value'
        ) AS has_value
    `);

    const row = result.rows[0];
    return Boolean(row?.has_bpm) && !row?.has_value;
  } finally {
    await client.end();
  }
};

const ensureIntegrationDatabaseReady = async () => {
  if (prepared || fs.existsSync(preparedMarkerPath)) {
    prepared = true;
    return;
  }

  fs.mkdirSync(path.dirname(preparedMarkerPath), { recursive: true });

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set for integration tests');
  }

  const dbUrl = new URL(databaseUrl);
  const dbName = dbUrl.pathname.replace(/^\//, '');
  if (!dbName) {
    throw new Error('Could not determine integration database name from DATABASE_URL');
  }

  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = '/postgres';

  const adminClient = new Client({ connectionString: adminUrl.toString() });
  await adminClient.connect();
  try {
    const exists = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      dbName,
    ]);
    if (exists.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE ${quoteIdent(dbName)}`);
    }
  } finally {
    await adminClient.end();
  }

  const schemaReady = await testSchemaReady(dbUrl);
  if (!schemaReady) {
    // ใช้ SQL migrations ตรงเพื่อเลี่ยง Prisma CLI issue (ERR_REQUIRE_ESM) บน Node 18
    applySqlMigrations(dbUrl, dbName);
  }

  prepared = true;
  fs.writeFileSync(preparedMarkerPath, `${Date.now()}\n`, 'utf8');
};

beforeAll(async () => {
  await ensureIntegrationDatabaseReady();
});

afterAll(async () => {
  // Allow pending async operations to settle before Jest exits
  await new Promise((resolve) => setTimeout(resolve, 500));
});
