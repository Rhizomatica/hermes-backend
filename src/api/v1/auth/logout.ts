import { logoutRequestSchema } from './logout.schema.js';
import type { FastifyInstance } from 'fastify';

export function logoutRoutes(app: FastifyInstance): void {
  app.post('/auth/logout', {
    schema: {
      description: 'Logout and revoke the current refresh token session',
      tags: ['auth'],
      body: logoutRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            message: { type: 'string' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    const { token, sessions } = app.services;

    // 1. Verify JWT signature and expiry — reject malformed/expired tokens
    try {
      token.verifyRefreshToken(refreshToken);
    } catch {
      return reply.code(401).send({ error: 'auth.invalid_refresh_token' });
    }

    // 2. Find the session by token hash
    const session = await sessions.findByTokenHash(refreshToken);

    if (!session) {
      // Token not in any session — already revoked or never existed
      return reply.code(401).send({ error: 'auth.invalid_refresh_token' });
    }

    // 3. Revoke the session (idempotent: if already revoked, no-op)
    if (!session.revokedAt) {
      await sessions.revoke(session.id);
    }

    return reply.status(200).send({ message: 'auth.logged_out' });
  });
}