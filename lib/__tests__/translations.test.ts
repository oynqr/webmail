import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const localesDir = path.resolve(__dirname, '../../locales');
const referenceLocale = 'en';

function getLeafKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...getLeafKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

function loadLocale(locale: string): Record<string, unknown> {
  const filePath = path.join(localesDir, locale, 'common.json');
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

const locales = fs
  .readdirSync(localesDir)
  .filter((entry) => fs.statSync(path.join(localesDir, entry)).isDirectory());

const referenceKeys = getLeafKeys(loadLocale(referenceLocale));

describe('translations completeness', () => {
  it('reference locale (en) should have keys', () => {
    expect(referenceKeys.length).toBeGreaterThan(0);
  });

  const otherLocales = locales.filter((l) => l !== referenceLocale);

  it.each(otherLocales)('%s should have all keys from en', (locale) => {
    const localeKeys = new Set(getLeafKeys(loadLocale(locale)));
    const missing = referenceKeys.filter((key) => !localeKeys.has(key));

    expect(missing, `Missing ${missing.length} keys in "${locale}":\n${missing.join('\n')}`).toEqual([]);
  });

  it.each(otherLocales)('%s should not have extra keys absent from en', (locale) => {
    const localeKeys = getLeafKeys(loadLocale(locale));
    const referenceSet = new Set(referenceKeys);
    const extra = localeKeys.filter((key) => !referenceSet.has(key));

    expect(extra, `Extra ${extra.length} keys in "${locale}":\n${extra.join('\n')}`).toEqual([]);
  });
});
