import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TokenPayload } from '../token.js';
import { sendError } from '../../shared/errors.js';

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
      return sendError(reply, 401, 'UNAUTHENTICATED', 'MISSING_ACCESS_TOKEN');
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return sendError(reply, 401, 'UNAUTHENTICATED', 'INVALID_ACCESS_TOKEN');
    }

    const token = parts[1];
    if (!token) {
      return sendError(reply, 401, 'UNAUTHENTICATED', 'INVALID_ACCESS_TOKEN');
    }

    try {
      const payload = app.services.token.verifyAccessToken(token);

      // Verify user still exists and is active
      const user = await app.services.users.findById(payload.sub);
      if (!user || user.status !== 'active') {
        return sendError(reply, 401, 'UNAUTHENTICATED', 'INVALID_ACCESS_TOKEN');
      }

      request.user = payload;
    } catch (err) {
      const error = err as Error & { name?: string };
      if (error.name === 'TokenExpiredError') {
        return sendError(reply, 401, 'TOKEN_EXPIRED', 'TOKEN_EXPIRED');
      }
      return sendError(reply, 401, 'UNAUTHENTICATED', 'INVALID_ACCESS_TOKEN');
    }
  });
}