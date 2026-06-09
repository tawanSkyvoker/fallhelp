/**
 * Integration Tests — Health Check
 *
 * Tests the system health endpoint:
 *   GET /internal/health  →  System status (internal monitor endpoint)
 */

import request from 'supertest';
import { app } from '../helpers';

describe('Health Check Integration', () => {
  it('GET /internal/health should return system status', async () => {
    const res = await request(app).get('/internal/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(['ok', 'degraded']).toContain(res.body.status);
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('services');
    expect(res.body.services).toHaveProperty('database');
  });

  it('should respond quickly (< 5 seconds)', async () => {
    const start = Date.now();
    await request(app).get('/internal/health');
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000);
  });
});
