import type { FastifyInstance } from 'fastify';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  /** GET /health — Liveness/readiness check */
  app.get(
    '/health',
    {
      schema: {
        description: 'Health check (liveness/readiness)',
        tags: ['system'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
              uptime: { type: 'number' },
              checks: {
                type: 'object',
                properties: {
                  database: { type: 'string' },
                  radio: { type: 'string' },
                  clock_synced: { type: 'boolean' },
                },
              },
              version: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      const dbResult = await app.adapter.healthCheck();
      return {
        status: dbResult.ok ? 'ok' : 'degraded',
        uptime: process.uptime(),
        checks: {
          database: dbResult.ok ? 'ok' : 'disconnected',
          radio: 'disconnected',
          clock_synced: true,
        },
        version: '0.1.0',
        timestamp: new Date().toISOString(),
      };
    },
  );

  /** GET /health/deep — Deep health check with timing */
  app.get(
    '/health/deep',
    {
      schema: {
        description: 'Deep health check with timing information',
        tags: ['system'],
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', enum: ['ok', 'degraded', 'unhealthy'] },
              checks: {
                type: 'object',
                properties: {
                  database: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      latencyMs: { type: 'number' },
                    },
                  },
                  radio: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      latencyMs: { type: 'number' },
                    },
                  },
                  clock_synced: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      source: { type: 'string' },
                      lastSyncAt: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (_request, _reply) => {
      const start = Date.now();
      const dbResult = await app.adapter.healthCheck();
      const dbLatency = Date.now() - start;
      return {
        status: dbResult.ok ? 'ok' : 'degraded',
        checks: {
          database: {
            status: dbResult.ok ? 'ok' : 'error',
            latencyMs: Number.parseFloat(dbLatency.toFixed(2)),
          },
          radio: { status: 'disconnected', latencyMs: 0 },
          clock_synced: {
            status: 'ok',
            source: 'system',
            lastSyncAt: new Date().toISOString(),
          },
        },
      };
    },
  );
}
