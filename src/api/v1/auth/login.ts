import { loginRequestSchema } from './login.schema.js';
import type { FastifyInstance } from 'fastify';

export function loginRoutes(app: FastifyInstance): void {
  app.post('/auth/login', {
    schema: {
      description: 'Login with callsign and password',
      tags: ['auth'],
      body: loginRequestSchema,
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
        403: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request, reply) => {
    const { callsign, password } = request.body as { callsign: string; password: string };
    const { verifyPassword } = await import('@auth/password.js');

    const { token, users, sessions } = app.services;

    const user = await users.findByCallsign(callsign);
    if (!user || !user.passwordHash) {
      return reply.code(401).send({ error: 'auth.invalid_credentials' });
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      return reply.code(401).send({ error: 'auth.invalid_credentials' });
    }

    if (user.status !== 'active') {
      return reply.code(403).send({ error: 'auth.account_inactive' });
    }

    const accessToken = token.signAccessToken({
      sub: user.id,
      callsign: user.callsign,
      role: user.role,
      locale: user.locale,
    });
    const refreshToken = token.signRefreshToken(user.id);

    const expiresAt = new Date(Date.now() + app.config.jwtRefreshExpiresIn * 1000).toISOString();
    await sessions.create({ userId: user.id, refreshToken, expiresAt });

    return reply.status(200).send({
      accessToken,
      refreshToken,
      expiresIn: app.config.jwtAccessExpiresIn,
    });
  });
}