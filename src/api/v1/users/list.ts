import { requireRole } from '@auth/middleware/rbac-guard.js';
import type { FastifyInstance } from 'fastify';

export function listUsersRoutes(app: FastifyInstance): void {
  app.get('/users', {
    preHandler: [app.authenticate, requireRole('admin')],
    schema: {
      response: {
        200: {
          type: 'array',
          items: {
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
        },
      },
    },
  }, async (_request, reply) => {
    const users = await app.services.users.listAll();

    // Strip password hashes from responses
    const safeUsers = users.map(({ passwordHash: _, ...safe }) => safe);
    return reply.send(safeUsers);
  });
}