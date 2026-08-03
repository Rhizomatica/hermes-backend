import Fastify from 'fastify';
import { healthRoutes } from '@api/v1/health.js';
import { loginRoutes } from '@api/v1/auth/login.js';
import { refreshRoutes } from '@api/v1/auth/refresh.js';
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

  loginRoutes(app);
  refreshRoutes(app);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    adapter: SQLiteAdapter;
  }
}