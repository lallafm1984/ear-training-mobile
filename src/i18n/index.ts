import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';

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

const LANGUAGE_KEY = '@melodygen_language';
const SUPPORTED_LANGS = ['ko', 'en', 'ja'];

const languageDetector = {
  type: 'languageDetector' as const,
  async: true,
  detect: async (callback: (lng: string) => void) => {
    try {
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (saved && SUPPORTED_LANGS.includes(saved)) {
        callback(saved);
        return;
      }
    } catch {}

    const deviceLang = getLocales()[0]?.languageCode ?? 'en';
    const matched = SUPPORTED_LANGS.includes(deviceLang) ? deviceLang : 'en';
    callback(matched);
  },
  init: () => {},
  cacheUserLanguage: async (lng: string) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lng);
    } catch {}
  },
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGS,
    ns: ['common', 'home', 'auth', 'profile', 'practice', 'exam', 'subscription', 'stats', 'editor', 'content', 'mascot', 'legal'],
    defaultNS: 'common',
    resources: {
      ko: {
        common: koCommon, home: koHome, auth: koAuth, profile: koProfile,
        practice: koPractice, exam: koExam, subscription: koSubscription,
        stats: koStats, editor: koEditor, content: koContent, mascot: koMascot, legal: koLegal,
      },
      en: {
        common: enCommon, home: enHome, auth: enAuth, profile: enProfile,
        practice: enPractice, exam: enExam, subscription: enSubscription,
        stats: enStats, editor: enEditor, content: enContent, mascot: enMascot, legal: enLegal,
      },
      ja: {
        common: jaCommon, home: jaHome, auth: jaAuth, profile: jaProfile,
        practice: jaPractice, exam: jaExam, subscription: jaSubscription,
        stats: jaStats, editor: jaEditor, content: jaContent, mascot: jaMascot, legal: jaLegal,
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
