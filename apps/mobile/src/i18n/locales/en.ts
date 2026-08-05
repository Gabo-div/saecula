// English is the reference locale: its key structure types every other
// locale (see ../i18next.d.ts) and is the fallback for missing keys.
const en: Translations = {
  common: {
    appName: 'Saecula',
    tagline: 'Twenty centuries, one timeline',
  },
  tabs: {
    home: 'Home',
    calendar: 'Calendar',
    saints: 'Saints',
    bible: 'Bible',
    catechism: 'Catechism',
    explore: 'Explore',
    profile: 'Profile',
  },
  catechism: {
    title: 'Catechism',
    loadError: 'Could not load the Catechism',
  },
  calendar: {
    title: 'Calendar',
    readings: 'Daily readings',
    readingsDesc: "The day's Mass readings",
    saints: 'Saints',
    saintsDesc: 'Feasts and memorials',
    celebrations: 'Celebrations',
    celebrationsDesc: 'The liturgical year',
    today: 'Today',
    loadError: 'Could not load the readings',
    noReadings: 'No readings available for this day.',
    calendarLoadError: 'Could not load the calendar',
    seasons: 'Seasons',
    solemnitiesAndFeasts: 'Solemnities & feasts',
    optional: 'optional',
    holyDay: 'Holy day of obligation',
    saintsEmpty: 'Only ferial days this month.',
    celebrationsEmpty: 'No solemnities or feasts this month.',
    readingTypes: {
      reading_1: 'First reading',
      reading_i: 'First reading',
      reading_2: 'Second reading',
      reading_ii: 'Second reading',
      responsorial_psalm: 'Responsorial psalm',
      psalm: 'Psalm',
      sequence: 'Sequence',
      gospel: 'Gospel',
      epistle: 'Epistle',
    },
  },
  home: {
    title: 'Today',
    dailyVerse: 'Daily verse',
    prayers: 'Prayers',
    ask: 'Ask',
    bible: 'Bible',
    celebrationOfDay: 'Celebration of the day',
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
  explore: {
    title: 'Explore',
    comingTitle: 'Coming soon',
    comingBody: 'The timeline will be available here soon.',
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
  tabs: {
    home: string;
    calendar: string;
    saints: string;
    bible: string;
    catechism: string;
    explore: string;
    profile: string;
  };
  catechism: { title: string; loadError: string };
  calendar: {
    title: string;
    readings: string;
    readingsDesc: string;
    saints: string;
    saintsDesc: string;
    celebrations: string;
    celebrationsDesc: string;
    today: string;
    loadError: string;
    noReadings: string;
    calendarLoadError: string;
    seasons: string;
    solemnitiesAndFeasts: string;
    optional: string;
    holyDay: string;
    saintsEmpty: string;
    celebrationsEmpty: string;
    readingTypes: Record<string, string>;
  };
  home: {
    title: string;
    dailyVerse: string;
    prayers: string;
    ask: string;
    bible: string;
    celebrationOfDay: string;
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
  explore: {
    title: string;
    comingTitle: string;
    comingBody: string;
  };
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
