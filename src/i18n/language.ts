export const LANGUAGE_KEY = '@melodygen_language';
export const SUPPORTED_LANGUAGES = ['ko', 'en', 'ja'] as const;
export const DEFAULT_LANGUAGE: SupportedLanguage = 'en';

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

type DeviceLocale = {
  languageCode?: string | null;
  languageTag?: string | null;
  languageRegionCode?: string | null;
  regionCode?: string | null;
};

export function normalizeSupportedLanguage(language?: string | null): SupportedLanguage | null {
  const baseLanguage = language?.trim().split(/[-_]/)[0]?.toLowerCase();

  return SUPPORTED_LANGUAGES.includes(baseLanguage as SupportedLanguage)
    ? (baseLanguage as SupportedLanguage)
    : null;
}

function normalizeRegion(region?: string | null): string | null {
  const normalized = region?.trim().toUpperCase();
  return normalized || null;
}

function extractRegionFromLanguageTag(languageTag?: string | null): string | null {
  const parts = languageTag?.trim().split(/[-_]/) ?? [];
  const region = parts.slice(1).find((part) => /^[A-Za-z]{2}$|^\d{3}$/.test(part));

  return normalizeRegion(region);
}

export function detectPreferredLanguage(locales: readonly DeviceLocale[]): SupportedLanguage {
  const primaryLocale = locales[0];
  if (!primaryLocale) return DEFAULT_LANGUAGE;

  const region =
    normalizeRegion(primaryLocale.regionCode) ??
    normalizeRegion(primaryLocale.languageRegionCode) ??
    extractRegionFromLanguageTag(primaryLocale.languageTag);

  if (region === 'KR') return 'ko';
  if (region === 'JP') return 'ja';

  return DEFAULT_LANGUAGE;
}
