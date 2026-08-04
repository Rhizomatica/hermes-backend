import { createUserRequestSchema } from './create.schema.js';
import { requireRole } from '@auth/middleware/rbac-guard.js';
import { hashPassword } from '@auth/password.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';

export function createUserRoutes(app: FastifyInstance): void {
  app.post('/users', {
    preHandler: [app.authenticate, requireRole('admin')],
    schema: {
      body: createUserRequestSchema,
      response: {
        201: {
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
        409: { type: 'object', properties: { error: { type: 'string' } } },
        500: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply) => {
    const { callsign, displayName, password, email, role, locale } = request.body as {
      callsign: string;
      displayName: string;
      password: string;
      email?: string;
      role?: string;
      locale?: string;
    };

    const { users } = app.services;

    // Check for duplicate callsign
    const existing = await users.findByCallsign(callsign);
    if (existing) {
      return reply.code(409).send({ error: 'user.callsign_exists' });
    }

    const passwordHash = await hashPassword(password);
    const now = new Date().toISOString();

    const user = await users.create({
      callsign,
      displayName,
      email: email ?? null,
      passwordHash,
      role: (role as 'admin' | 'operator' | 'user' | 'readonly') ?? 'user',
      status: 'active',
      avatarPath: null,
      metadata: '{}',
      locale: (locale as 'en' | 'es' | 'pt-BR') ?? 'en',
      createdAt: now,
      updatedAt: now,
      lastSeenAt: null,
    });

    // Strip password hash from response
    const { passwordHash: _, ...safeUser } = user;
    return reply.code(201).send(safeUser);
  });
}