/**
 * i18n Coverage Checker
 *
 * Verifies that all locale resource files have exactly the same translation keys.
 * The en/ locale is the reference. Any key present in en/ must also exist in
 * es/ and pt-BR/.
 *
 * Usage: npm run i18n:check
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/check-i18n.ts → resolve to src/i18n/resources/
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const RESOURCES_DIR = join(__dirname, '..', 'src', 'i18n', 'resources');

const LOCALES = ['en', 'es', 'pt-BR'] as const;
const DOMAINS = ['errors', 'validation', 'auth', 'system', 'audit', 'email'] as const;

interface CheckResult {
  locale: string;
  domain: string;
  missingKeys: string[];
  extraKeys: string[];
}

function loadKeys(filePath: string): string[] {
  if (!existsSync(filePath)) {
    return [];
  }
  const raw = readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw) as Record<string, string>;
  return Object.keys(data).sort();
}

function main(): void {
  const results: CheckResult[] = [];

  // En is the reference locale
  const referenceLocale = LOCALES[0]!;

  for (const domain of DOMAINS) {
    const refPath = join(RESOURCES_DIR, referenceLocale, `${domain}.json`);
    const refKeys = loadKeys(refPath);

    if (refKeys.length === 0) {
      console.log(`⚠️  Reference file is empty or missing: ${relative(process.cwd(), refPath)}`);
      continue;
    }

    for (const locale of LOCALES.slice(1)) {
      const localePath = join(RESOURCES_DIR, locale, `${domain}.json`);
      const localeKeys = loadKeys(localePath);

      const missingKeys = refKeys.filter((k) => !localeKeys.includes(k));
      const extraKeys = localeKeys.filter((k) => !refKeys.includes(k));

      if (missingKeys.length > 0 || extraKeys.length > 0) {
        results.push({ locale, domain, missingKeys, extraKeys });
      }
    }
  }

  if (results.length === 0) {
    console.log('✅ All locales have the same keys as the en/ reference.');
    console.log(`   Checked ${DOMAINS.length} domains × ${LOCALES.length} locales.`);
    return;
  }

  for (const result of results) {
    const prefix = `${result.locale}/${result.domain}:`;
    if (result.missingKeys.length > 0) {
      console.log(`❌ ${prefix} missing keys (present in en/):`);
      for (const key of result.missingKeys) {
        console.log(`   - ${key}`);
      }
    }
    if (result.extraKeys.length > 0) {
      console.log(`⚠️  ${prefix} extra keys (not in en/):`);
      for (const key of result.extraKeys) {
        console.log(`   + ${key}`);
      }
    }
  }

  console.log(`\n${results.length} issue(s) found.`);
  process.exit(1);
}

main();