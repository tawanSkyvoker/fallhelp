/**
 * Integration Test Helpers
 *
 * Provides utilities for creating test users, authenticating,
 * and cleaning the database between tests.
 */

import request from 'supertest';
import app from '../../app';
import prisma from '../../prisma';

export { app, prisma };

// ─── Unique Data Generators ───────────────────────────────────────────────────

let userCounter = 0;

/** Generate a unique email address for each test user */
export function uniqueEmail(prefix = 'test'): string {
  return `${prefix}-${Date.now()}-${++userCounter}@test.com`;
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

/** A strong password that passes isPasswordStrong (uppercase + lowercase + number + ≥8 chars) */
export const STRONG_PASSWORD = 'TestPass123';

interface RegisterResult {
  res: request.Response;
  data: { email: string; password: string; firstName: string; lastName: string };
  token?: string;
  user?: Record<string, unknown>;
}

/**
 * Register a new user with a unique email.
 * Returns the HTTP response, the data sent, the JWT token, and the user object.
 */
export async function registerUser(
  overrides: Record<string, unknown> = {},
): Promise<RegisterResult> {
  const data = {
    email: uniqueEmail(),
    password: STRONG_PASSWORD,
    firstName: 'Test',
    lastName: 'User',
    ...overrides,
  };

  const res = await request(app).post('/api/auth/register').send(data);

  return {
    res,
    data: data as RegisterResult['data'],
    token: res.body?.data?.token,
    user: res.body?.data?.user,
  };
}

/**
 * Login with the given credentials.
 * Returns the HTTP response, the JWT token, and the user object.
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<{ res: request.Response; token?: string; user?: Record<string, unknown> }> {
  const res = await request(app).post('/api/auth/login').send({ email, password });

  return {
    res,
    token: res.body?.data?.token,
    user: res.body?.data?.user,
  };
}

/**
 * Create a helper function that adds Authorization header to supertest requests.
 */
export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ─── Database Cleanup ─────────────────────────────────────────────────────────

/**
 * Truncate ALL user tables (preserving _prisma_migrations).
 * Uses CASCADE to handle foreign key constraints automatically.
 */
export async function cleanDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != '_prisma_migrations'
  `;

  if (tables.length === 0) return;

  const tableNames = tables.map((t) => `"public"."${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} CASCADE`);
}

/**
 * Disconnect Prisma client and underlying pg pool.
 * Call in afterAll to prevent lingering connections.
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
}
