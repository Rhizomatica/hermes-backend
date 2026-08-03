import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TokenPayload } from '../token.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: TokenPayload;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function registerJwtVerifier(app: FastifyInstance): Promise<void> {
  app.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return reply.code(401).send({
        error: 'auth.missing_token',
        code: 'UNAUTHENTICATED',
        statusCode: 401,
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return reply.code(401).send({
        error: 'auth.invalid_token',
        code: 'UNAUTHENTICATED',
        statusCode: 401,
      });
    }

    const token = parts[1];
    if (!token) {
      return reply.code(401).send({
        error: 'auth.invalid_token',
        code: 'UNAUTHENTICATED',
        statusCode: 401,
      });
    }

    try {
      const payload = app.services.token.verifyAccessToken(token);

      // Verify user still exists and is active
      const user = await app.services.users.findById(payload.sub);
      if (!user || user.status !== 'active') {
        return reply.code(401).send({
          error: 'auth.invalid_token',
          code: 'UNAUTHENTICATED',
          statusCode: 401,
        });
      }

      request.user = payload;
    } catch (err) {
      const error = err as Error & { name?: string };
      if (error.name === 'TokenExpiredError') {
        return reply.code(401).send({
          error: 'auth.token_expired',
          code: 'TOKEN_EXPIRED',
          statusCode: 401,
        });
      }
      return reply.code(401).send({
        error: 'auth.invalid_token',
        code: 'UNAUTHENTICATED',
        statusCode: 401,
      });
    }
  });
}