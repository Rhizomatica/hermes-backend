import { describe, it, expect } from 'vitest';
import { detectLocale, parseAcceptLanguage } from '../../../src/i18n/locale-detector.js';
import type { Locale } from '../../../src/i18n/types.js';

describe('Locale Detector', () => {
  describe('detectLocale', () => {
    it('should use user preference when provided', () => {
      expect(detectLocale({ userLocale: 'es' })).toBe('es');
    });

    it('should use user preference over Accept-Language', () => {
      expect(
        detectLocale({
          userLocale: 'pt-BR',
          acceptLanguageHeader: 'es-MX,es;q=0.9',
        }),
      ).toBe('pt-BR');
    });

    it('should fall back to Accept-Language when no user preference', () => {
      expect(
        detectLocale({
          acceptLanguageHeader: 'es-MX,es;q=0.9',
        }),
      ).toBe('es');
    });

    it('should handle pt-BR from Accept-Language header', () => {
      expect(
        detectLocale({
          acceptLanguageHeader: 'pt-BR,pt;q=0.9,en;q=0.5',
        }),
      ).toBe('pt-BR');
    });

    it('should fall back to en when both are absent', () => {
      expect(detectLocale({})).toBe('en');
    });

    it('should fall back to en when userLocale is unsupported', () => {
      expect(detectLocale({ userLocale: 'fr' })).toBe('en');
    });

    it('should fall back to en when userLocale is null', () => {
      expect(detectLocale({ userLocale: null })).toBe('en');
    });

    it('should handle regional variant es-MX → es', () => {
      expect(
        detectLocale({ acceptLanguageHeader: 'es-MX' }),
      ).toBe('es');
    });

    it('should respect quality values in Accept-Language', () => {
      // pt has q=0.9, en has q=0.5 → pt should win (maps to pt-BR)
      const result = detectLocale({
        acceptLanguageHeader: 'en;q=0.5,pt;q=0.9',
      });
      expect(result).toBe('pt-BR');
    });
  });

  describe('parseAcceptLanguage', () => {
    it('should parse a simple language tag', () => {
      expect(parseAcceptLanguage('es-MX')).toBe('es');
    });

    it('should return pt-BR for pt tags', () => {
      expect(parseAcceptLanguage('pt')).toBe('pt-BR');
      expect(parseAcceptLanguage('pt-BR')).toBe('pt-BR');
      expect(parseAcceptLanguage('pt-PT')).toBe('pt-BR');
    });

    it('should return en for en tags', () => {
      expect(parseAcceptLanguage('en')).toBe('en');
      expect(parseAcceptLanguage('en-US')).toBe('en');
      expect(parseAcceptLanguage('en-GB')).toBe('en');
    });

    it('should return es for es tags', () => {
      expect(parseAcceptLanguage('es')).toBe('es');
      expect(parseAcceptLanguage('es-MX')).toBe('es');
      expect(parseAcceptLanguage('es-AR')).toBe('es');
    });

    it('should respect quality values and sort by q', () => {
      // es has q=0.5, pt has q=0.9 → pt-BR should win
      const result = detectLocale({
        acceptLanguageHeader: 'es;q=0.5,pt;q=0.9',
      });
      expect(result).toBe('pt-BR');
    });

    it('should return null for unsupported languages', () => {
      expect(parseAcceptLanguage('fr')).toBeNull();
      expect(parseAcceptLanguage('de-DE')).toBeNull();
      expect(parseAcceptLanguage('zh-CN')).toBeNull();
    });

    it('should handle empty header', () => {
      const result = detectLocale({ acceptLanguageHeader: '' });
      expect(result).toBe('en');
    });

    it('should handle header with only unsupported languages', () => {
      const result = detectLocale({ acceptLanguageHeader: 'fr-FR,de-DE' });
      expect(result).toBe('en');
    });
  });
});