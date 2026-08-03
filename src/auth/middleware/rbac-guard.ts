import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';

export type Role = 'admin' | 'operator' | 'user' | 'readonly';

/**
 * Create a preHandler hook that checks the authenticated user's role
 * against the list of allowed roles. Must be used after `app.authenticate`.
 */
export function requireRole(...allowedRoles: Role[]): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { user } = request;
    if (!user) {
      return reply.code(401).send({
        error: 'auth.unauthenticated',
        code: 'UNAUTHENTICATED',
        statusCode: 401,
      });
    }

    if (!allowedRoles.includes(user.role as Role)) {
      return reply.code(403).send({
        error: 'auth.forbidden',
        code: 'FORBIDDEN',
        statusCode: 403,
      });
    }
  };
}

export async function registerRbacGuard(_app: FastifyInstance): Promise<void> {
  // RBAC guard is used as a per-route preHandler — no global registration needed.
  // The requireRole() function is imported and passed directly to route definitions.
}