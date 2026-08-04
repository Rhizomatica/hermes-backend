/** Supported locale codes. */
export type Locale = 'en' | 'es' | 'pt-BR';

/** All valid locale codes. */
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'es', 'pt-BR'] as const;

/** Translation key — maps to keys in resource JSON files. */
export type TranslationKey = string;

/** Variable interpolation parameters for translation templates. */
export type TranslationParams = Record<string, string | number>;