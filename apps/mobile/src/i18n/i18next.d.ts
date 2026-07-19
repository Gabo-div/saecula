import 'i18next';

import type en from './locales/en';

// Types every t('...') call against the English reference locale, so a
// typo in a key is a compile error, not a blank label at runtime.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: {
      translation: typeof en;
    };
  }
}
