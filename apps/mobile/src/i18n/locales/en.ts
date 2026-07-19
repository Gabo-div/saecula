// English is the reference locale: its key structure types every other
// locale (see ../i18next.d.ts) and is the fallback for missing keys.
const en: Translations = {
  common: {
    appName: 'Saecula',
    tagline: 'Twenty centuries, one timeline',
  },
  tabs: {
    home: 'Home',
    saints: 'Saints',
    bible: 'Bible',
    explore: 'Explore',
    profile: 'Profile',
  },
  home: {
    title: 'Today',
    dailyVerse: 'Daily verse',
    prayers: 'Prayers',
    ask: 'Ask',
    bible: 'Bible',
    todaysWord: "Today's word",
    dailyReading: 'Daily reading',
    readChapter: 'Read chapter',
  },
  bible: {
    title: 'Bible',
    bookAndVersion: 'Book & version',
    chapter: 'chapter',
    version: 'Version',
    oldTestament: 'Old Testament',
    newTestament: 'New Testament',
    chaptersAbbr: 'ch.',
    loadError: 'Could not load the chapter',
  },
  saints: {
    title: 'Saints',
    comingTitle: 'Saints are on their way',
    comingBody: 'Saints will be seeded into the graph as nodes connected to the timeline.',
  },
  explore: {
    title: 'Explore',
    loadError: 'Could not load the timeline',
    empty: 'Nothing on the timeline yet — seed data with saecula-cli.',
    noText: 'No text available in this language yet',
  },
  profile: {
    title: 'Profile',
    account: 'Account',
    signOut: 'Sign out',
  },
  settings: {
    title: 'Settings',
    theme: 'Theme',
    dark: 'Dark',
    amoled: 'AMOLED',
    light: 'Light',
    accent: 'Accent color',
    language: 'Language',
    translation: 'Bible translation',
    defaultTranslation: 'Default (per language)',
  },
  login: {
    email: 'Email',
    password: 'Password',
    signIn: 'Sign in',
    createAccount: 'Create account',
    haveAccount: 'Already have an account? Sign in',
    noAccount: "Don't have an account? Register",
    connectionFailed: 'Connection failed',
  },
};

// Shared shape: same keys everywhere, free values per locale.
export interface Translations {
  common: { appName: string; tagline: string };
  tabs: { home: string; saints: string; bible: string; explore: string; profile: string };
  home: {
    title: string;
    dailyVerse: string;
    prayers: string;
    ask: string;
    bible: string;
    todaysWord: string;
    dailyReading: string;
    readChapter: string;
  };
  bible: {
    title: string;
    bookAndVersion: string;
    chapter: string;
    version: string;
    oldTestament: string;
    newTestament: string;
    chaptersAbbr: string;
    loadError: string;
  };
  saints: { title: string; comingTitle: string; comingBody: string };
  explore: { title: string; loadError: string; empty: string; noText: string };
  profile: { title: string; account: string; signOut: string };
  settings: {
    title: string;
    theme: string;
    dark: string;
    amoled: string;
    light: string;
    accent: string;
    language: string;
    translation: string;
    defaultTranslation: string;
  };
  login: {
    email: string;
    password: string;
    signIn: string;
    createAccount: string;
    haveAccount: string;
    noAccount: string;
    connectionFailed: string;
  };
}

export default en;
