/** Supported locale codes. */
export type Locale = 'en' | 'es' | 'pt-BR';

/** All valid locale codes. */
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es', 'pt-BR'] as const;

/**
 * Translation key — a compile-time safe union of all keys present in the
 * English (en/) resource files. Passing any string not in this union to
 * `t()` will produce a TypeScript compiler error.
 *
 * Generated from the en/ resource files at the type level — no runtime code.
 */
export type TranslationKey =
  | 'AUDIT_LOGIN_FAILED'
  | 'AUDIT_LOGIN_SUCCESS'
  | 'AUDIT_LOGOUT'
  | 'AUDIT_PASSWORD_CHANGED'
  | 'AUDIT_TOKEN_REFRESHED'
  | 'AUDIT_TOKEN_REUSE_DETECTED'
  | 'AUDIT_USER_CREATED'
  | 'AUTH_ACCOUNT_INACTIVE'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_INVALID_REFRESH_TOKEN'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_REUSE_DETECTED'
  | 'AUTH_TOKEN_REVOKED'
  | 'AUTHENTICATION_REQUIRED'
  | 'CONFLICT'
  | 'CONTENT_TOO_LARGE'
  | 'EMAIL_NEW_MESSAGE_SUBJECT'
  | 'EMAIL_PASSWORD_RECOVERY_SUBJECT'
  | 'EMAIL_SECURITY_ALERT_SUBJECT'
  | 'EMAIL_SYSTEM_HEALTH_SUBJECT'
  | 'FORBIDDEN'
  | 'INSUFFICIENT_PERMISSIONS'
  | 'INTERNAL_ERROR'
  | 'INVALID_ACCESS_TOKEN'
  | 'INVALID_PAYLOAD'
  | 'MISSING_ACCESS_TOKEN'
  | 'NOT_FOUND'
  | 'PARTICIPANT_LIMIT_EXCEEDED'
  | 'RATE_LIMITED'
  | 'SYSTEM_CLOCK_SYNCED'
  | 'SYSTEM_CLOCK_UNSYNCED'
  | 'SYSTEM_HEALTH_DEGRADED'
  | 'SYSTEM_HEALTH_OK'
  | 'SYSTEM_REBOOTING'
  | 'SYSTEM_RECOVERY_IN_PROGRESS'
  | 'SYSTEM_SHUTTING_DOWN'
  | 'TOKEN_EXPIRED'
  | 'UNAUTHENTICATED'
  | 'VALIDATION_CALLSIGN'
  | 'VALIDATION_EMAIL'
  | 'VALIDATION_FORMAT'
  | 'VALIDATION_LOCALE'
  | 'VALIDATION_MAX_LENGTH'
  | 'VALIDATION_MIN_LENGTH'
  | 'VALIDATION_PASSWORD_CONTAINS_CALLSIGN'
  | 'VALIDATION_PASSWORD_WEAK'
  | 'VALIDATION_REQUIRED';

/** Variable interpolation parameters for translation templates. */
export type TranslationParams = Record<string, string | number>;