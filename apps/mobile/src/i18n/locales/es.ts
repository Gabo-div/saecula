import type en from './en';

const es: typeof en = {
  common: {
    appName: 'Saecula',
    tagline: 'Veinte siglos, una línea del tiempo',
  },
  tabs: {
    home: 'Inicio',
    saints: 'Santos',
    bible: 'Biblia',
    explore: 'Explorar',
    profile: 'Perfil',
  },
  home: {
    title: 'Hoy',
    dailyVerse: 'Versículo del día',
    prayers: 'Oración',
    ask: 'Preguntar',
    bible: 'Biblia',
    todaysWord: 'Palabra de hoy',
    dailyReading: 'Lectura del día',
    readChapter: 'Leer capítulo',
  },
  bible: {
    title: 'Biblia',
    bookAndVersion: 'Libro y versión',
    chapter: 'capítulo',
    version: 'Versión',
    oldTestament: 'Antiguo Testamento',
    newTestament: 'Nuevo Testamento',
    chaptersAbbr: 'cap.',
    loadError: 'No se pudo cargar el capítulo',
  },
  saints: {
    title: 'Santos',
    comingTitle: 'Santoral en camino',
    comingBody: 'Los santos se sembrarán en el grafo como nodos conectados a la línea del tiempo.',
  },
  explore: {
    title: 'Explorar',
    loadError: 'No se pudo cargar la línea del tiempo',
    empty: 'Nada en la línea del tiempo — siembra datos con saecula-cli.',
    noText: 'Sin texto disponible en este idioma todavía',
  },
  profile: {
    title: 'Perfil',
    account: 'Cuenta',
    signOut: 'Cerrar sesión',
  },
  settings: {
    title: 'Ajustes',
    language: 'Idioma',
    translation: 'Traducción de la Biblia',
    defaultTranslation: 'Por defecto (según idioma)',
  },
  login: {
    email: 'Email',
    password: 'Contraseña',
    signIn: 'Entrar',
    createAccount: 'Crear cuenta',
    haveAccount: '¿Ya tienes cuenta? Entra',
    noAccount: '¿No tienes cuenta? Regístrate',
    connectionFailed: 'Fallo de conexión',
  },
};

export default es;
