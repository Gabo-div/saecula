// English is the reference locale: its key structure types every other
// locale (see ../i18next.d.ts) and is the fallback for missing keys.
const en: Translations = {
  common: {
    appName: 'Saecula',
    tagline: 'Twenty centuries, one timeline',
    cancel: 'Cancel',
    delete: 'Delete',
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
    translation: 'Translation',
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
    dailyCatechism: 'Catechism of the day',
    prayers: 'Prayers',
    ask: 'Ask',
    bible: 'Bible',
    celebrationOfDay: 'Celebration of the day',
  },
  streak: {
    title: 'Streak',
    tagline: 'Every day you pray or read adds to your streak.',
    current: 'current streak',
    best: 'best streak',
    today: 'Done today',
    notToday: 'Not yet today',
    daysThisYear_one: '{{count}} day this year',
    daysThisYear_other: '{{count}} days this year',
    weeks_one: '{{count}} week in a row',
    weeks_other: '{{count}} weeks in a row',
    history: 'View history',
    completedTitle: 'Day complete!',
    keepGoing: 'Keep it up — don’t break your streak.',
    continue: 'Continue',
  },
  prayers: {
    individual: 'Prayers',
    guided: 'Guided prayers',
    language: 'Language',
    todaysMysteries: "Today's mysteries",
    mysteries: 'Mysteries',
    order: 'Order of prayer',
    forEachMystery: 'For each of the five mysteries',
    begin: 'Begin',
    finished: 'Prayer complete',
    again: 'Pray again',
  },
  reader: {
    accessibility: 'Accessibility',
    fontSize: 'Font size',
    searchPlaceholder: 'Search…',
    searchHint: 'Type at least two letters to search.',
    noResults: 'No results',
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
  apiKeys: {
    title: 'API keys',
    subtitle: 'Let an AI assistant read your Saecula library over MCP.',
    newKey: 'New key',
    namePlaceholder: 'Name (e.g. laptop)',
    create: 'Create',
    copyOnce: 'Copy it now — this key is never shown again.',
    copy: 'Copy',
    copied: 'Copied',
    done: 'Done',
    revokeConfirm: 'Anything using this key stops working immediately.',
    revoke: 'Revoke',
    empty: 'No keys yet.',
    calls: 'calls',
    errors: 'errors',
    loadError: 'Could not load your keys',
    createError: 'Could not create the key',
    tooMany: 'Too many active keys. Revoke one first.',
    revokeError: 'Could not revoke the key',
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
  chat: {
    title: 'Ask',
    placeholder: 'Ask about Scripture or the Catechism…',
    empty: 'Ask a question to begin.',
    newChat: 'New chat',
    history: 'History',
    emptyHistory: 'No conversations yet.',
    thinking: 'Thinking…',
    consulting: 'Consulting {{source}}…',
    error: 'Something went wrong. Please try again.',
    retry: 'Retry',
    disabled: 'The assistant is not available yet.',
    deleteConfirm: 'Delete this conversation?',
    toolDone: 'Done',
    toolWorking: 'Working…',
    toolInput: 'Input',
    toolOutput: 'Output',
    copy: 'Copy',
    copied: 'Copied',
    details: 'Details',
    close: 'Close',
    references: 'References',
    model: 'Model',
    tools: 'Tools',
    noTools: 'No tools were used for this answer.',
    toolSearchScripture: 'Consulting the Scriptures…',
    toolGetVerses: 'Reading a passage of Scripture…',
    toolSearchCatechism: 'Searching the Catechism…',
    toolGetCatechism: 'Reading the Catechism…',
    toolGraphRelated: 'Looking up related references…',
    toolSearchScripturePast: 'Consulted the Scriptures',
    toolGetVersesPast: 'Read a passage of Scripture',
    toolSearchCatechismPast: 'Searched the Catechism',
    toolGetCatechismPast: 'Read the Catechism',
    toolGraphRelatedPast: 'Looked up related references',
    suggestions: 'Suggested questions',
    suggestWhatDoesChurchTeach: 'What does the Church teach about grace?',
    suggestCatechismOnFaith: "What does the Catechism say about faith?",
    suggestDailyGospel: 'How can I live out today’s Gospel?',
    suggestExplainBaptism: 'Explain the meaning of Baptism.',
  },
  bookmarks: {
    title: 'Saved',
    all: 'All',
    highlighted: 'Highlighted',
    withNotes: 'With notes',
    empty: 'No saved verses yet. Tap and hold any verse in the Bible to save it.',
    save: 'Save verse',
    saved: 'Saved',
    remove: 'Remove from saved',
    highlight: 'Highlight',
    addNote: 'Add a note',
    editNote: 'Edit note',
    notePlaceholder: 'Write your personal note…',
    saveNote: 'Save note',
    share: 'Share',
    shareImage: 'Share as image',
    background: 'Background',
    bgNone: 'No background',
    bgImage: 'Image',
    shareText: 'Share as text',
    copyLink: 'Copy link',
    shareVia: 'Shared via Saecula',
    saveError: 'Could not save the verse',
    removeError: 'Could not remove the verse',
    highlightError: 'Could not apply highlight',
    noteError: 'Could not save the note',
    multiSelect: '{{count}} selected',
    multiSelectOne: '1 selected',
    highlightSelected: 'Highlight selected',
    noteForSelected: 'Add note to selected',
    noteForSelectedPlaceholder: 'Write a note for the selected verses…',
    shareMulti: 'Share as text',
    shareMultiImage: 'Share as image',
    shareMultiImageHint: 'Max 3 verses for image share',
    imageSaved: 'Image saved to gallery',
    imageSaveError: 'Could not save image',
    note: 'Note',
    related: 'Related',
    relatedEmpty: 'Nothing related yet.',
    dragMore: 'Swipe up for more',
    format: 'Format',
  },
};

// Shared shape: same keys everywhere, free values per locale.
export interface Translations {
  common: { appName: string; tagline: string; cancel: string; delete: string };
  tabs: {
    home: string;
    calendar: string;
    saints: string;
    bible: string;
    catechism: string;
    explore: string;
    profile: string;
  };
  catechism: {
    title: string;
    loadError: string;
    translation: string;
  };
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
    dailyCatechism: string;
    prayers: string;
    ask: string;
    bible: string;
    celebrationOfDay: string;
  };
  streak: {
    title: string;
    tagline: string;
    current: string;
    best: string;
    today: string;
    notToday: string;
    daysThisYear_one: string;
    daysThisYear_other: string;
    weeks_one: string;
    weeks_other: string;
    history: string;
    completedTitle: string;
    keepGoing: string;
    continue: string;
  };
  prayers: {
    individual: string;
    guided: string;
    language: string;
    todaysMysteries: string;
    mysteries: string;
    order: string;
    forEachMystery: string;
    begin: string;
    finished: string;
    again: string;
  };
  reader: {
    accessibility: string;
    fontSize: string;
    searchPlaceholder: string;
    searchHint: string;
    noResults: string;
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
  apiKeys: {
    title: string;
    subtitle: string;
    newKey: string;
    namePlaceholder: string;
    create: string;
    copyOnce: string;
    copy: string;
    copied: string;
    done: string;
    revokeConfirm: string;
    revoke: string;
    empty: string;
    calls: string;
    errors: string;
    loadError: string;
    createError: string;
    tooMany: string;
    revokeError: string;
  };
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
  chat: {
    title: string;
    placeholder: string;
    empty: string;
    newChat: string;
    history: string;
    emptyHistory: string;
    thinking: string;
    consulting: string;
    error: string;
    retry: string;
    disabled: string;
    deleteConfirm: string;
    toolDone: string;
    toolWorking: string;
    toolInput: string;
    toolOutput: string;
    copy: string;
    copied: string;
    details: string;
    close: string;
    references: string;
    model: string;
    tools: string;
    noTools: string;
    toolSearchScripture: string;
    toolGetVerses: string;
    toolSearchCatechism: string;
    toolGetCatechism: string;
    toolGraphRelated: string;
    toolSearchScripturePast: string;
    toolGetVersesPast: string;
    toolSearchCatechismPast: string;
    toolGetCatechismPast: string;
    toolGraphRelatedPast: string;
    suggestions: string;
    suggestWhatDoesChurchTeach: string;
    suggestCatechismOnFaith: string;
    suggestDailyGospel: string;
    suggestExplainBaptism: string;
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
  bookmarks: {
    title: string;
    all: string;
    highlighted: string;
    withNotes: string;
    empty: string;
    save: string;
    saved: string;
    remove: string;
    highlight: string;
    addNote: string;
    editNote: string;
    notePlaceholder: string;
    saveNote: string;
    share: string;
    shareImage: string;
    background: string;
    bgNone: string;
    bgImage: string;
    shareText: string;
    copyLink: string;
    shareVia: string;
    saveError: string;
    removeError: string;
    highlightError: string;
    noteError: string;
    multiSelect: string;
    multiSelectOne: string;
    highlightSelected: string;
    noteForSelected: string;
    noteForSelectedPlaceholder: string;
    shareMulti: string;
    shareMultiImage: string;
    shareMultiImageHint: string;
    imageSaved: string;
    imageSaveError: string;
    note: string;
    related: string;
    relatedEmpty: string;
    dragMore: string;
    format: string;
  };
}

export default en;
