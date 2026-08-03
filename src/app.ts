import Fastify from 'fastify';
import { healthRoutes } from '@api/v1/health.js';
import { loginRoutes } from '@api/v1/auth/login.js';
import { refreshRoutes } from '@api/v1/auth/refresh.js';
import { TokenService } from '@auth/token.js';
import { UsersRepository } from '@db/repositories/users.repository.js';
import { SessionsRepository } from '@db/repositories/sessions.repository.js';
import type { AppConfig } from '@shared/config.js';
import type { SQLiteAdapter } from '@db/sqlite.adapter.js';
import type { FastifyInstance } from 'fastify';

export interface AppDependencies {
  config: AppConfig;
  adapter: SQLiteAdapter;
}

export interface AppServices {
  token: TokenService;
  users: UsersRepository;
  sessions: SessionsRepository;
}

export async function buildApp(deps: AppDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: deps.config.logLevel,
    },
  });

  app.decorate('config', deps.config);
  app.decorate('adapter', deps.adapter);
  app.decorate('services', {
    token: new TokenService(deps.config),
    users: new UsersRepository(deps.adapter),
    sessions: new SessionsRepository(deps.adapter),
  } satisfies AppServices);

  await app.register(healthRoutes);

  loginRoutes(app);
  refreshRoutes(app);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    adapter: SQLiteAdapter;
    services: AppServices;
  }
}