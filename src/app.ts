import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { healthRoutes } from '@api/v1/health.js';
import { loginRoutes } from '@api/v1/auth/login.js';
import { refreshRoutes } from '@api/v1/auth/refresh.js';
import { logoutRoutes } from '@api/v1/auth/logout.js';
import { TokenService } from '@auth/token.js';
import { UsersRepository } from '@db/repositories/users.repository.js';
import { SessionsRepository } from '@db/repositories/sessions.repository.js';
import { registerJwtVerifier } from '@auth/middleware/jwt-verifier.js';
import { registerRbacGuard } from '@auth/middleware/rbac-guard.js';
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

  // Middleware chain: CORS → Helmet → Rate Limiter → JWT Verifier → RBAC Guard
  await app.register(cors, {
    origin: deps.config.corsOrigins === '*' ? true : deps.config.corsOrigins.split(',').map((s) => s.trim()),
    credentials: true,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
    },
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      // Use X-Forwarded-For header if behind proxy, otherwise use remoteAddress
      return (request.headers['x-forwarded-for'] as string) ?? request.ip;
    },
    errorResponseBuilder: (_request, _context) => {
      return {
        error: 'auth.rate_limited',
        code: 'RATE_LIMITED',
        statusCode: 429,
      };
    },
  });

  // JWT verifier decorator (app.authenticate)
  await registerJwtVerifier(app);

  // RBAC guard (per-route preHandler via requireRole())
  await registerRbacGuard(app);

  await app.register(healthRoutes);

  loginRoutes(app);
  refreshRoutes(app);
  logoutRoutes(app);

  return app;
}

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    adapter: SQLiteAdapter;
    services: AppServices;
  }
}