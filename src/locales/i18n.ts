// Modified by Applexus Technologies, 2026-10-10: English brand overlay and {{brand}} default (AGPL-3.0)
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import translationEn from './en/translation.json';
import { DEFAULT_BRAND_NAME } from '@/aura/brand';
import auraEn from '@/aura/en.json';

export const defaultNS = 'translation';

export const resources = {
  en: { translation: { ...translationEn, ...auraEn } },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: {
      default: ['en'],
    },
    fallbackNS: 'translation',
    ns: ['translation'],
    debug: false,
    defaultNS,
    resources,
    interpolation: { escapeValue: false, defaultVariables: { brand: DEFAULT_BRAND_NAME } },
  });

export default i18n;
