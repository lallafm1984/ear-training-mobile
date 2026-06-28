import {
  DEFAULT_LANGUAGE,
  detectPreferredLanguage,
  normalizeSupportedLanguage,
} from '../i18n/language';

describe('i18n language detection', () => {
  it('normalizes supported base languages and region tags', () => {
    expect(normalizeSupportedLanguage('ko')).toBe('ko');
    expect(normalizeSupportedLanguage('ko-KR')).toBe('ko');
    expect(normalizeSupportedLanguage('en-US')).toBe('en');
    expect(normalizeSupportedLanguage('ja_JP')).toBe('ja');
  });

  it('uses Korean and Japanese only for Korea and Japan device regions', () => {
    expect(detectPreferredLanguage([{ regionCode: 'KR', languageTag: 'en-KR' }])).toBe('ko');
    expect(detectPreferredLanguage([{ regionCode: 'JP', languageTag: 'en-JP' }])).toBe('ja');
  });

  it('infers Korea and Japan from the primary language tag when regionCode is unavailable', () => {
    expect(detectPreferredLanguage([{ regionCode: null, languageTag: 'ko-KR' }])).toBe('ko');
    expect(detectPreferredLanguage([{ regionCode: null, languageTag: 'ja-JP' }])).toBe('ja');
  });

  it('falls back to English outside Korea and Japan even when the language is supported', () => {
    expect(normalizeSupportedLanguage('zh-Hans')).toBeNull();
    expect(detectPreferredLanguage([])).toBe(DEFAULT_LANGUAGE);
    expect(
      detectPreferredLanguage([{ regionCode: 'US', languageCode: 'ko', languageTag: 'ko-US' }]),
    ).toBe(DEFAULT_LANGUAGE);
    expect(
      detectPreferredLanguage([{ regionCode: 'FR', languageCode: 'ja', languageTag: 'ja-FR' }]),
    ).toBe(DEFAULT_LANGUAGE);
  });
});
