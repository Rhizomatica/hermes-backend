import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { SQLiteAdapter } from '../../src/db/sqlite.adapter.js';
import type { AppConfig } from '../../src/shared/config.js';
import type { FastifyInstance } from 'fastify';

const testConfig: AppConfig = {
  databasePath: ':memory:',
  port: 0,
  host: '127.0.0.1',
  corsOrigins: '*',
  logLevel: 'silent',
  radioDriver: 'simulated',
  dbAdapter: 'sqlite',
  jwtPrivateKeyPath: '/tmp/test-private.pem',
  jwtPublicKeyPath: '/tmp/test-public.pem',
  jwtAccessExpiresIn: 900,
  jwtRefreshExpiresIn: 604800,
};

describe('Health Endpoints', () => {
  let app: FastifyInstance;
  let adapter: SQLiteAdapter;

  beforeAll(async () => {
    adapter = new SQLiteAdapter(':memory:');
    app = await buildApp({ config: testConfig, adapter });
    await app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await app.close();
    await adapter.close();
  });

  it('should return 200 from GET /health with status ok', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);

    const body = response.json<{
      status: string;
      uptime: number;
      checks: { database: string; radio: string; clock_synced: boolean };
      version: string;
      timestamp: string;
    }>();
    expect(body.status).toBe('ok');
    expect(body.checks.database).toBe('ok');
    expect(body.checks.radio).toBe('disconnected');
    expect(body.version).toBe('0.1.0');
    expect(typeof body.uptime).toBe('number');
    expect(typeof body.timestamp).toBe('string');
  });

  it('should return 200 from GET /health/deep with timing info', async () => {
    const response = await app.inject({ method: 'GET', url: '/health/deep' });
    expect(response.statusCode).toBe(200);

    const body = response.json<{
      status: string;
      checks: {
        database: { status: string; latencyMs: number };
        radio: { status: string; latencyMs: number };
        clock_synced: { status: string; source: string; lastSyncAt: string };
      };
    }>();
    expect(body.status).toBe('ok');
    expect(body.checks.database.status).toBe('ok');
    expect(typeof body.checks.database.latencyMs).toBe('number');
    expect(body.checks.radio.status).toBe('disconnected');
  });
});