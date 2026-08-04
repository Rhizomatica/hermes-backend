import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { healthRoutes } from '@api/v1/health.js';
import { loginRoutes } from '@api/v1/auth/login.js';
import { refreshRoutes } from '@api/v1/auth/refresh.js';
import { logoutRoutes } from '@api/v1/auth/logout.js';
import { meRoutes } from '@api/v1/users/me.js';
import { createUserRoutes } from '@api/v1/users/create.js';
import { listUsersRoutes } from '@api/v1/users/list.js';
import { TokenService } from '@auth/token.js';
import { UsersRepository } from '@db/repositories/users.repository.js';
import { SessionsRepository } from '@db/repositories/sessions.repository.js';
import { registerJwtVerifier } from '@auth/middleware/jwt-verifier.js';
import { detectLocale } from '@i18n/locale-detector.js';
import type { Locale } from '@i18n/types.js';
import type { AppConfig } from '@shared/config.js';
import type { DatabaseAdapter } from '@db/adapter.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export interface AppDependencies {
  config: AppConfig;
  adapter: DatabaseAdapter;
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

  // Decorate request with locale property (defaults to 'en').
  // The locale is set by the onRequest hook below.
  app.decorateRequest('locale', 'en' as Locale);

  // Locale middleware — runs before every request, detects locale from Accept-Language header.
  //
  // TODO D3.12: Also detect locale from the JWT Bearer token's `locale` claim.
  // The JWT decode must happen here (onRequest) since `app.authenticate` runs later
  // as a preHandler. Use app.services.token.verifyAccessToken() to extract payload.locale,
  // then pass it to detectLocale({ userLocale: payload.locale, ... }).
  // Per docs/development/plan.md D3.12, the resolution chain should be:
  //   JWT locale claim → Accept-Language header → 'en' fallback.
  //
  // Note: verifyAccessToken may throw for expired tokens — catch and fall through
  // to Accept-Language. Expired-token locale is still valid for error messages.
  app.addHook('onRequest', (request: FastifyRequest) => {
    const acceptLanguage = request.headers['accept-language'];
    const acceptLanguageStr = typeof acceptLanguage === 'string' ? acceptLanguage : undefined;
    request.locale = detectLocale({ acceptLanguageHeader: acceptLanguageStr });
  });

  await app.register(healthRoutes);

  loginRoutes(app);
  refreshRoutes(app);
  logoutRoutes(app);

  meRoutes(app);
  createUserRoutes(app);
  listUsersRoutes(app);

  return app;
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Resolved locale for the current request (set by onRequest hook). */
    locale: Locale;
  }

  interface FastifyInstance {
    config: AppConfig;
    adapter: DatabaseAdapter;
    services: AppServices;
  }
}
