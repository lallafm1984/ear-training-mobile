import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_KEY,
  SUPPORTED_LANGUAGES,
  detectPreferredLanguage,
  normalizeSupportedLanguage,
} from './language';

// ── ko ──
import koCommon from './locales/ko/common.json';
import koHome from './locales/ko/home.json';
import koAuth from './locales/ko/auth.json';
import koProfile from './locales/ko/profile.json';
import koPractice from './locales/ko/practice.json';
import koExam from './locales/ko/exam.json';
import koSubscription from './locales/ko/subscription.json';
import koStats from './locales/ko/stats.json';
import koEditor from './locales/ko/editor.json';
import koContent from './locales/ko/content.json';
import koMascot from './locales/ko/mascot.json';
import koLegal from './locales/ko/legal.json';
import koBeginner from './locales/ko/beginner.json';
import koLevelTest from './locales/ko/levelTest.json';

// ── en ──
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enAuth from './locales/en/auth.json';
import enProfile from './locales/en/profile.json';
import enPractice from './locales/en/practice.json';
import enExam from './locales/en/exam.json';
import enSubscription from './locales/en/subscription.json';
import enStats from './locales/en/stats.json';
import enEditor from './locales/en/editor.json';
import enContent from './locales/en/content.json';
import enMascot from './locales/en/mascot.json';
import enLegal from './locales/en/legal.json';
import enBeginner from './locales/en/beginner.json';
import enLevelTest from './locales/en/levelTest.json';

// ── ja ──
import jaCommon from './locales/ja/common.json';
import jaHome from './locales/ja/home.json';
import jaAuth from './locales/ja/auth.json';
import jaProfile from './locales/ja/profile.json';
import jaPractice from './locales/ja/practice.json';
import jaExam from './locales/ja/exam.json';
import jaSubscription from './locales/ja/subscription.json';
import jaStats from './locales/ja/stats.json';
import jaEditor from './locales/ja/editor.json';
import jaContent from './locales/ja/content.json';
import jaMascot from './locales/ja/mascot.json';
import jaLegal from './locales/ja/legal.json';
import jaBeginner from './locales/ja/beginner.json';
import jaLevelTest from './locales/ja/levelTest.json';

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      const savedLanguage = normalizeSupportedLanguage(saved);
      if (savedLanguage) {
        callback(savedLanguage);
        return;
      }
    } catch {
      // If storage is unavailable, fall back to the device locale.
    }

    callback(detectPreferredLanguage(getLocales()));
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    const language = normalizeSupportedLanguage(lng);
    if (!language) return;

    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, language);
    } catch {
      // Language preference caching is best effort only.
    }
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: [...SUPPORTED_LANGUAGES],
    load: 'languageOnly',
    ns: [
      'common',
      'home',
      'auth',
      'profile',
      'practice',
      'exam',
      'subscription',
      'stats',
      'editor',
      'content',
      'mascot',
      'legal',
      'beginner',
      'levelTest',
    ],
    defaultNS: 'common',
    resources: {
      ko: {
        common: koCommon,
        home: koHome,
        auth: koAuth,
        profile: koProfile,
        practice: koPractice,
        exam: koExam,
        subscription: koSubscription,
        stats: koStats,
        editor: koEditor,
        content: koContent,
        mascot: koMascot,
        legal: koLegal,
        beginner: koBeginner,
        levelTest: koLevelTest,
      },
      en: {
        common: enCommon,
        home: enHome,
        auth: enAuth,
        profile: enProfile,
        practice: enPractice,
        exam: enExam,
        subscription: enSubscription,
        stats: enStats,
        editor: enEditor,
        content: enContent,
        mascot: enMascot,
        legal: enLegal,
        beginner: enBeginner,
        levelTest: enLevelTest,
      },
      ja: {
        common: jaCommon,
        home: jaHome,
        auth: jaAuth,
        profile: jaProfile,
        practice: jaPractice,
        exam: jaExam,
        subscription: jaSubscription,
        stats: jaStats,
        editor: jaEditor,
        content: jaContent,
        mascot: jaMascot,
        legal: jaLegal,
        beginner: jaBeginner,
        levelTest: jaLevelTest,
      },
    },
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
