import type en from './en';

// Ecclesiastical Latin — the app's third content language deserves a UI too.
const la: typeof en = {
  common: {
    appName: 'Saecula',
    tagline: 'Viginti saecula, una linea temporum',
  },
  tabs: {
    home: 'Domus',
    saints: 'Sancti',
    bible: 'Biblia',
    explore: 'Explora',
    profile: 'Persona',
  },
  home: {
    title: 'Hodie',
    dailyVerse: 'Versiculus diei',
    prayers: 'Preces',
    ask: 'Interroga',
    bible: 'Biblia',
    todaysWord: 'Verbum hodiernum',
    dailyReading: 'Lectio diei',
    readChapter: 'Lege caput',
  },
  bible: {
    title: 'Biblia',
    bookAndVersion: 'Liber et versio',
    chapter: 'caput',
    version: 'Versio',
    oldTestament: 'Vetus Testamentum',
    newTestament: 'Novum Testamentum',
    chaptersAbbr: 'cap.',
    loadError: 'Caput legi non potuit',
  },
  saints: {
    title: 'Sancti',
    comingTitle: 'Sancti mox aderunt',
    comingBody: 'Sancti in grapho serentur, lineae temporum conexi.',
  },
  explore: {
    title: 'Explora',
    loadError: 'Linea temporum legi non potuit',
    empty: 'Nihil adhuc in linea temporum — semina data per saecula-cli.',
    noText: 'Textus hac lingua nondum praesto est',
  },
  profile: {
    title: 'Persona',
    account: 'Ratio',
    signOut: 'Exire',
  },
  settings: {
    title: 'Optiones',
    theme: 'Aspectus',
    dark: 'Obscurum',
    amoled: 'AMOLED',
    light: 'Clarum',
    accent: 'Color accentus',
    language: 'Lingua',
    translation: 'Versio Bibliae',
    defaultTranslation: 'Praedefinita (secundum linguam)',
  },
  login: {
    email: 'Email',
    password: 'Tessera',
    signIn: 'Ingredi',
    createAccount: 'Rationem crea',
    haveAccount: 'Rationem iam habes? Ingredere',
    noAccount: 'Rationem non habes? Inscribere',
    connectionFailed: 'Conexio defecit',
  },
};

export default la;
