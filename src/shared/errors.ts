import type { FastifyReply } from 'fastify';
import type { FastifyRequest } from 'fastify';
import { t } from '../i18n/index.js';
import type { Locale, TranslationParams } from '../i18n/types.js';

/**
 * Standardized error response helper following RFC 7807 Problem Detail format.
 *
 * Reads the request's `locale` property (set by the locale middleware) to
 * translate the `message` field into the user's preferred language.
 *
 * @param reply - Fastify reply object
 * @param status - HTTP status code
 * @param code - Machine-readable error code (RFC 7807 `code` field, never translated)
 * @param i18nKey - Translation key for the `message` field
 * @param params - Optional template variables for the translation
 * @param details - Optional array of field-level error details
 *
 * @see docs/architecture/api.md §7 — Error Handling
 * @see docs/development/i18n.md §4.2 — Localized Error Responses
 */
export function sendError(
  reply: FastifyReply,
  status: number,
  code: string,
  i18nKey: string,
  params?: TranslationParams,
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

  // Use the locale set on the request by the onRequest hook
  const request = reply.request as FastifyRequest & { locale?: Locale };
  const locale = request.locale ?? 'en';
  const message = t(locale, i18nKey, params);

  reply.code(status).send({
    type: `https://hermes.example.com/errors/${code.toLowerCase()}`,
    title: titles[status] ?? 'Unknown Error',
    status,
    code,
    message,
    ...(details && { details }),
  });
}