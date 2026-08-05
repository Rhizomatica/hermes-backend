import { createProfileSchema, updateProfileSchema, profileResponseSchema } from './profiles.schema.js';
import { RadioProfilesRepository, type RadioMode } from '@db/repositories/radio-profiles.repository.js';
import { requireRole } from '@auth/middleware/rbac-guard.js';
import type { FastifyInstance, FastifyRequest } from 'fastify';

/**
 * Radio profiles CRUD routes — `/api/v1/radio/profiles`
 *
 * Endpoints:
 * - `GET    /radio/profiles`          — List all profiles for the authenticated user's station
 * - `POST   /radio/profiles`          — Create a new profile (operator+)
 * - `GET    /radio/profiles/:id`      — Get a specific profile by ID
 * - `PATCH  /radio/profiles/:id`      — Update a profile (operator+)
 * - `DELETE /radio/profiles/:id`      — Delete a profile (operator+)
 */
export function profileRoutes(app: FastifyInstance): void {
  const repo = new RadioProfilesRepository(app.adapter);

  // -- List all profiles ---------------------------------------------

  app.get('/radio/profiles', {
    preHandler: [app.authenticate],
    schema: {
      response: {
        200: {
          type: 'array',
          items: profileResponseSchema,
        },
      },
    },
  }, async (request: FastifyRequest, reply) => {
    // Use the authenticated user's ID as stationId.
    const profiles = await repo.listByStationId(request.user.sub);
    return reply.send(profiles);
  });

  // -- Create profile ------------------------------------------------

  app.post('/radio/profiles', {
    preHandler: [app.authenticate, requireRole('admin', 'operator')],
    schema: {
      body: createProfileSchema,
      response: {
        201: profileResponseSchema,
        400: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply) => {
    const body = request.body as {
      stationId: string;
      profileIndex: number;
      name: string;
      frequencyHz: number;
      mode: RadioMode;
      volume?: number;
      bfoHz?: number;
      digitalVoice?: number;
      powerLevel?: number | null;
      isActive?: number;
    };

    // Check for duplicate profileIndex for this station.
    const existing = await repo.listByStationId(body.stationId);
    const duplicate = existing.find((p) => p.profileIndex === body.profileIndex);
    if (duplicate) {
      return reply.code(400).send({ error: `Profile index ${body.profileIndex} already exists for this station` });
    }

    const now = new Date().toISOString();
    const profile = await repo.create({
      stationId: body.stationId,
      profileIndex: body.profileIndex,
      name: body.name,
      frequencyHz: body.frequencyHz,
      mode: body.mode,
      volume: body.volume ?? 50,
      bfoHz: body.bfoHz ?? 0,
      digitalVoice: body.digitalVoice ?? 0,
      powerLevel: body.powerLevel ?? null,
      isActive: body.isActive ?? 0,
      createdAt: now,
      updatedAt: now,
    });

    return reply.code(201).send(profile);
  });

  // -- Get profile by ID ---------------------------------------------

  app.get('/radio/profiles/:id', {
    preHandler: [app.authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: profileResponseSchema,
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const profile = await repo.findById(id);

    if (!profile) {
      return reply.code(404).send({ error: `Profile ${id} not found` });
    }

    return reply.send(profile);
  });

  // -- Update profile -------------------------------------------------

  app.patch('/radio/profiles/:id', {
    preHandler: [app.authenticate, requireRole('admin', 'operator')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      body: updateProfileSchema,
      response: {
        200: profileResponseSchema,
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      name: string;
      frequencyHz: number;
      mode: RadioMode;
      volume: number;
      bfoHz: number;
      digitalVoice: number;
      powerLevel: number | null;
      isActive: number;
    }>;

    const updates: Record<string, unknown> = {};
    for (const key of ['name', 'frequencyHz', 'mode', 'volume', 'bfoHz', 'digitalVoice', 'powerLevel', 'isActive'] as const) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    // Auto-update updatedAt.
    updates.updatedAt = new Date().toISOString();

    const profile = await repo.update(id, updates);
    if (!profile) {
      return reply.code(404).send({ error: `Profile ${id} not found` });
    }

    return reply.send(profile);
  });

  // -- Delete profile -------------------------------------------------

  app.delete('/radio/profiles/:id', {
    preHandler: [app.authenticate, requireRole('admin', 'operator')],
    schema: {
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            deleted: { type: 'boolean' },
          },
        },
        404: { type: 'object', properties: { error: { type: 'string' } } },
      },
    },
  }, async (request: FastifyRequest, reply) => {
    const { id } = request.params as { id: string };

    const deleted = await repo.delete(id);
    if (!deleted) {
      return reply.code(404).send({ error: `Profile ${id} not found` });
    }

    return reply.send({ deleted: true });
  });
}