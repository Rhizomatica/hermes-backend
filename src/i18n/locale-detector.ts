import type { Locale } from './types.js';
import { SUPPORTED_LOCALES } from './types.js';

/**
 * Detects the preferred locale from the available sources.
 *
 * Resolution order:
 * 1. User preference (from JWT `locale` claim or `users.locale` column)
 * 2. HTTP `Accept-Language` header
 * 3. Universal fallback: `en`
 */
export function detectLocale({
  userLocale,
  acceptLanguageHeader,
}: {
  userLocale?: string | null;
  acceptLanguageHeader?: string;
}): Locale {
  // 1. User preference (from JWT or database)
  if (userLocale && isSupportedLocale(userLocale)) {
    return userLocale;
  }

  // 2. Accept-Language header parsing
  if (acceptLanguageHeader) {
    const detected = parseAcceptLanguage(acceptLanguageHeader);
    if (detected) {
      return detected;
    }
  }

  // 3. Fallback
  return 'en';
}

/**
 * Validates whether a string is a supported locale.
 */
function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Parses the `Accept-Language` header and returns the first supported locale.
 *
 * Handles regional variants: `es-MX` resolves to `es`, `pt-BR` stays as `pt-BR`.
 * Respects quality values (`q=`).
 */
export function parseAcceptLanguage(header: string): Locale | null {
  const locales = header
    .split(',')
    .map((part) => part.trim())
    .map((part) => {
      const segments = part.split(';');
      const lang = segments[0]?.trim() ?? '';
      const qValue = segments[1]?.trim();
      const q = qValue?.startsWith('q=') ? parseFloat(qValue.slice(2)) : 1.0;
      return { lang, q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of locales) {
    // Try exact match first
    const exactMatch = mapToSupportedLocale(lang);
    if (exactMatch) {
      return exactMatch;
    }
  }

  return null;
}

/**
 * Maps an Accept-Language tag to one of our supported locales.
 *
 * Handles regional variants:
 * - `es-MX`, `es-AR`, `es-*` → `es`
 * - `pt-BR`, `pt-PT` → `pt-BR`
 * - `en-US`, `en-GB` → `en`
 */
function mapToSupportedLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase();

  // pt-BR is special — keep as literal match since it's a compound locale code.
  // Use startsWith('pt-') to avoid greedily matching non-Portuguese tags.
  if (lower === 'pt-br' || lower === 'pt_br' || lower === 'pt' || lower.startsWith('pt-')) {
    return 'pt-BR';
  }

  if (lower === 'es' || lower.startsWith('es-') || lower.startsWith('es_')) {
    return 'es';
  }

  if (lower === 'en' || lower.startsWith('en-') || lower.startsWith('en_')) {
    return 'en';
  }

  return null;
}