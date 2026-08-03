import { SessionsRepository } from '@db/repositories/sessions.repository.js';
import { UsersRepository } from '@db/repositories/users.repository.js';
import { TokenService } from '@auth/token.js';
import { refreshRequestSchema } from './refresh.schema.js';
import type { FastifyInstance } from 'fastify';

export function refreshRoutes(app: FastifyInstance): void {
  app.post('/auth/refresh', {
    schema: {
      description: 'Refresh access token using refresh token with rotation and reuse detection',
      tags: ['auth'],
      body: refreshRequestSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            expiresIn: { type: 'number' },
          },
        },
        401: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken: string };

    const tokenSvc = new TokenService(app.config);
    const sessions = new SessionsRepository(app.adapter);

    // 1. Verify JWT signature and expiry
    try {
      tokenSvc.verifyRefreshToken(refreshToken);
    } catch {
      return reply.code(401).send({ error: 'auth.invalid_refresh_token' });
    }

    // 2. Look up the session by token hash (without revokedAt filter so we can check replaced_by)
    const session = await sessions.findByTokenHash(refreshToken);

    if (!session) {
      return reply.code(401).send({ error: 'auth.invalid_refresh_token' });
    }

    // 3. REUSE DETECTION: If this token was already replaced, it's been stolen
    if (session.refreshReplacedBy) {
      // Revoke ALL sessions for this user per ADR-004
      await sessions.revokeAllForUser(session.userId);
      app.log.warn({ userId: session.userId }, 'Refresh token reuse detected — all sessions revoked');
      return reply.code(401).send({ error: 'auth.token_reuse_detected' });
    }

    // 4. Check if the session is revoked or expired
    if (session.revokedAt) {
      return reply.code(401).send({ error: 'auth.token_revoked' });
    }

    if (new Date(session.expiresAt) < new Date()) {
      return reply.code(401).send({ error: 'auth.token_expired' });
    }

    // 5. Fetch user to get claims for new access token
    const users = new UsersRepository(app.adapter);
    const user = await users.findById(session.userId);
    if (!user || user.status !== 'active') {
      return reply.code(401).send({ error: 'auth.account_inactive' });
    }

    // 6. Issue new token pair
    const newAccessToken = tokenSvc.signAccessToken({
      sub: user.id,
      callsign: user.callsign,
      role: user.role,
      locale: user.locale,
    });
    const newRefreshToken = tokenSvc.signRefreshToken(user.id);

    const newExpiresAt = new Date(Date.now() + app.config.jwtRefreshExpiresIn * 1000).toISOString();

    // 7. Atomic rotation: mark old as replaced, insert new session
    try {
      await sessions.createAndReplace(session.id, {
        userId: user.id,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
      });
    } catch (err) {
      app.log.error(err, 'Failed to rotate refresh token');
      return reply.code(500).send({ error: 'internal_error' });
    }

    return reply.status(200).send({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: app.config.jwtAccessExpiresIn,
    });
  });
}