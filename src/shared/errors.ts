import type { FastifyReply } from 'fastify';

/**
 * Standardized error response helper following RFC 7807 Problem Detail format.
 *
 * @see docs/architecture/api.md §7 — Error Handling
 */
export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  message: string,
  details?: Array<{ field: string; message: string }>,
): void {
  const titles: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    503: 'Service Unavailable',
  };

  reply.code(status).send({
    type: `https://hermes.example.com/errors/${code.toLowerCase()}`,
    title: titles[status] ?? 'Unknown Error',
    status,
    code,
    message,
    ...(details && { details }),
  });
}