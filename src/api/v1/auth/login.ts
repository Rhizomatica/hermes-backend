import { verifyPassword } from '@auth/password.js';
import { UsersRepository } from '@db/repositories/users.repository.js';
import { SessionsRepository } from '@db/repositories/sessions.repository.js';
import { TokenService } from '@auth/token.js';
import { loginRequestSchema } from './login.schema.js';
import type { FastifyInstance } from 'fastify';

export function loginRoutes(app: FastifyInstance): void {
  app.post(
    '/auth/login',
    {
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
        },
      },
    },
    async (request, reply) => {
      const { callsign, password } = request.body as { callsign: string; password: string };

      const usersRepo = new UsersRepository(app.adapter);
      const user = await usersRepo.findByCallsign(callsign);

      if (!user || !user.passwordHash) {
        return reply.code(401).send({ error: 'auth.invalid_credentials' });
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return reply.code(401).send({ error: 'auth.invalid_credentials' });
      }

      if (user.status !== 'active') {
        return reply.code(403).send({ error: 'auth.account_suspended' });
      }

      const tokenService = new TokenService(app.config);
      const accessToken = await tokenService.signAccessToken({
        sub: user.id,
        callsign: user.callsign,
        role: user.role,
        locale: user.locale,
      });
      const refreshToken = await tokenService.signRefreshToken(user.id);

      const sessionsRepo = new SessionsRepository(app.adapter);
      const expiresAt = new Date(Date.now() + app.config.jwtRefreshExpiresIn * 1000).toISOString();
      await sessionsRepo.create({ userId: user.id, refreshToken, expiresAt });

      return reply.status(200).send({
        accessToken,
        refreshToken,
        expiresIn: app.config.jwtAccessExpiresIn,
      });
    },
  );
}