import * as Localization from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import type { LanguageCode } from '@/types/api';
import en from './locales/en';
import es from './locales/es';
import la from './locales/la';

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['en', 'es', 'la'];

// Best-guess initial language from the device before the persisted store
// hydrates; the store subscription in App.tsx has the final word.
export function deviceLanguage(): LanguageCode {
  const code = Localization.getLocales()[0]?.languageCode;
  return code === 'es' ? 'es' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
    la: { translation: la },
  },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  supportedLngs: SUPPORTED_LANGUAGES,
  interpolation: {
    // React already escapes rendered strings.
    escapeValue: false,
  },
});

export default i18n;
