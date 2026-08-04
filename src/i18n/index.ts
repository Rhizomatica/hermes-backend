import type { Locale, TranslationKey, TranslationParams } from './types.js';

// Static JSON imports — resolved at build time, work with tsc output.
// Uses import attributes required by NodeNext module resolution.
import enErrors from './resources/en/errors.json' with { type: 'json' };
import enValidation from './resources/en/validation.json' with { type: 'json' };
import enAuth from './resources/en/auth.json' with { type: 'json' };
import enSystem from './resources/en/system.json' with { type: 'json' };
import enAudit from './resources/en/audit.json' with { type: 'json' };
import enEmail from './resources/en/email.json' with { type: 'json' };

import esErrors from './resources/es/errors.json' with { type: 'json' };
import esValidation from './resources/es/validation.json' with { type: 'json' };
import esAuth from './resources/es/auth.json' with { type: 'json' };
import esSystem from './resources/es/system.json' with { type: 'json' };
import esAudit from './resources/es/audit.json' with { type: 'json' };
import esEmail from './resources/es/email.json' with { type: 'json' };

import ptBRErrors from './resources/pt-BR/errors.json' with { type: 'json' };
import ptBRValidation from './resources/pt-BR/validation.json' with { type: 'json' };
import ptBRAuth from './resources/pt-BR/auth.json' with { type: 'json' };
import ptBRSystem from './resources/pt-BR/system.json' with { type: 'json' };
import ptBRAudit from './resources/pt-BR/audit.json' with { type: 'json' };
import ptBREmail from './resources/pt-BR/email.json' with { type: 'json' };

/** All loaded translation resources, keyed by locale then by translation key. */
const resources: Record<Locale, Record<string, string>> = {
  en: {
    ...enErrors,
    ...enValidation,
    ...enAuth,
    ...enSystem,
    ...enAudit,
    ...enEmail,
  },
  es: {
    ...esErrors,
    ...esValidation,
    ...esAuth,
    ...esSystem,
    ...esAudit,
    ...esEmail,
  },
  'pt-BR': {
    ...ptBRErrors,
    ...ptBRValidation,
    ...ptBRAuth,
    ...ptBRSystem,
    ...ptBRAudit,
    ...ptBREmail,
  },
};

/**
 * Translates a key into the given locale.
 *
 * Uses double-bracket interpolation: `{{varName}}`.
 *
 * @param locale - The target locale.
 * @param key - The translation key (matches keys in resource JSON files).
 * @param params - Optional variable substitution values.
 * @returns The translated string, or the raw key if no translation is found.
 *
 * @example
 * ```ts
 * t('es', 'TOKEN_EXPIRED') // "El token de acceso ha expirado."
 * t('en', 'NOT_FOUND', { resourceType: 'User' }) // "The requested resource was not found: User"
 * ```
 */
export function t(
  locale: Locale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  // Look up translation: requested locale → English fallback → raw key
  const template =
    resources[locale]?.[key] ?? resources['en']?.[key] ?? key;

  return interpolate(template, params);
}

/**
 * Substitutes `{{varName}}` placeholders with values from `params`.
 *
 * @example
 * ```ts
 * interpolate('Hello {{name}}', { name: 'World' }) // "Hello World"
 * ```
 */
export function interpolate(
  template: string,
  params?: TranslationParams,
): string {
  if (!params) return template;

  return template.replace(/\{\{(\w+)\}\}/g, (_match, varName: string) => {
    const value = params[varName];
    return value !== undefined ? String(value) : `{{${varName}}}`;
  });
}

// Re-export types for convenience
export type { Locale, TranslationKey, TranslationParams };