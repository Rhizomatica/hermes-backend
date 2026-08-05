import { logoutRequestSchema } from './logout.schema.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export function logoutRoutes(app: FastifyInstance): void {
  app.post('/auth/logout', {
    preHandler: [app.authenticate],
    schema: {
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
  }, async (request: FastifyRequest, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };
    const { token, sessions } = app.services;

    // Verify the refresh token is a well-formed JWT
    let refreshPayload: { sub: string };
    try {
      refreshPayload = token.verifyRefreshToken(refreshToken);
    } catch {
      return reply.code(401).send({ error: 'auth.invalid_refresh_token' });
    }

    // Verify the refresh token belongs to the authenticated user
    if (refreshPayload.sub !== request.user.sub) {
      return reply.code(401).send({ error: 'auth.invalid_refresh_token' });
    }

    // Find and revoke the session
    const session = await sessions.findByTokenHash(refreshToken);
    if (!session) {
      // Token not in any session — already revoked or never existed
      // Idempotent: return 200 — the caller's session is effectively gone
      return reply.status(200).send({ message: 'auth.logged_out' });
    }

    if (!session.revokedAt) {
      await sessions.revoke(session.id);
    }

    return reply.status(200).send({ message: 'auth.logged_out' });
  });
}