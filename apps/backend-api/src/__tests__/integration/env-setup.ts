/**
 * Integration Test — Environment Setup
 *
 * Runs as `setupFiles` (before test file imports).
 * Sets process.env so that dotenv.config() in app.ts won't overwrite them.
 * (dotenv never overwrites existing env vars by default.)
 *
 * DATABASE_URL is derived from the dev .env file (via dotenv) but
 * the database name is swapped to `fallhelp_test` so tests never
 * touch the production/development database.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load apps/backend-api/.env to get DB credentials without hardcoding them
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

// Derive test DATABASE_URL: take dev URL and swap DB name → fallhelp_test
const devUrl = process.env.DATABASE_URL || '';
const testUrl = devUrl.replace(/\/[^/?]+(\?|$)/, '/fallhelp_test$1');

if (!testUrl || !testUrl.includes('fallhelp_test')) {
  throw new Error(
    'Could not derive test DATABASE_URL from .env. ' +
      'Make sure apps/backend-api/.env exists with a valid DATABASE_URL.',
  );
}

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testUrl;
process.env.JWT_SECRET = 'integration-test-secret-key-min-32-characters-long';
process.env.JWT_EXPIRES_IN = '7d';
process.env.MQTT_DISABLED = 'true';
process.env.DISABLE_EMAIL = 'true';
