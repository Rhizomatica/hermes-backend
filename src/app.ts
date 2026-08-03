import Fastify from 'fastify';
import { healthRoutes } from '@api/v1/health.js';
import type { AppConfig } from '@shared/config.js';
import type { SQLiteAdapter } from '@db/sqlite.adapter.js';
import type { FastifyInstance } from 'fastify';

export interface AppDependencies {
  config: AppConfig;
  adapter: SQLiteAdapter;
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: deps.config.logLevel,
    },
  });

  app.decorate('config', deps.config);
  app.decorate('adapter', deps.adapter);

  await app.register(healthRoutes);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    adapter: SQLiteAdapter;
  }
}