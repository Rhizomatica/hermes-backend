import { sendError } from '../../shared/errors.js';
import type { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';

export type Role = 'admin' | 'operator' | 'user' | 'readonly';

/**
 * Create a preHandler hook that checks the authenticated user's role
 * against the list of allowed roles. Must be used after `app.authenticate`.
 *
 * Usage:
 *   app.get('/admin-only', {
 *     preHandler: [app.authenticate, requireRole('admin')],
 *   }, handler);
 */
export function requireRole(...allowedRoles: Role[]): preHandlerHookHandler {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { user } = request;
    if (!user) {
      return sendError(reply, 401, 'UNAUTHENTICATED', 'AUTHENTICATION_REQUIRED');
    }

    if (!allowedRoles.includes(user.role as Role)) {
      return sendError(reply, 403, 'FORBIDDEN', 'INSUFFICIENT_PERMISSIONS');
    }
  };
}


