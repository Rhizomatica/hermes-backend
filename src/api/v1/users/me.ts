import type { FastifyInstance } from 'fastify';

export function meRoutes(app: FastifyInstance): void {
  app.get(
    '/users/me',
    {
      preHandler: [app.authenticate],
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              callsign: { type: 'string' },
              displayName: { type: 'string' },
              email: { type: 'string' },
              role: { type: 'string' },
              status: { type: 'string' },
              avatarPath: { type: 'string' },
              locale: { type: 'string' },
              metadata: { type: 'string' },
              createdAt: { type: 'string' },
              updatedAt: { type: 'string' },
              lastSeenAt: { type: 'string' },
            },
          },
          404: { type: 'object', properties: { error: { type: 'string' } } },
        },
      },
    },
    async (request, reply) => {
      const user = await app.services.users.findById(request.user.sub);
      if (!user) {
        return reply.code(404).send({ error: 'user.not_found' });
      }

      // Strip password hash from response
      const { passwordHash: _, ...safeUser } = user;
      return reply.send(safeUser);
    },
  );
}