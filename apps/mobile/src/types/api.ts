// Shapes returned by the Go backend.

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user: User;
}

export interface LocalizedText {
  language_code: string;
  translation_id: string;
  raw_content: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineNode {
  id: string;
  labels: string[];
  start_year: number;
  end_year?: number;
  era?: string;
  props: Record<string, unknown>;
  text?: LocalizedText;
}

export interface TimelineResponse {
  start_year: number;
  end_year: number;
  lang: string;
  count: number;
  nodes: TimelineNode[];
}

export type LanguageCode = 'en' | 'es' | 'la';

// --- Bible ------------------------------------------------------------------

export interface Book {
  code: string;
  slug: string;
  name: string;
  testament: 'OT' | 'NT';
  chapters: number;
  start_year: number;
  end_year: number;
  era: string;
}

export interface BooksResponse {
  count: number;
  books: Book[];
}

export interface Verse {
  entity_id: string;
  number: number;
  text: string;
  language_code: string;
  translation_id: string;
}

export interface ChapterResponse {
  book_code: string;
  book_slug: string;
  book_name: string;
  chapter: number;
  lang: string;
  verses: Verse[];
}

export interface Translation {
  id: string;
  language_code: string;
  verse_count: number;
}

export interface TranslationsResponse {
  translations: Translation[];
}

export interface DailyVerseResponse {
  entity_id: string;
  book_code: string;
  book_name: string;
  chapter: number;
  verse: number;
  reference: string;
  date: string;
  text?: Verse;
}

// --- Daily readings ---------------------------------------------------------

export interface ReadingVerse {
  entity_id: string;
  book_code: string;
  chapter: number;
  number: number;
  text?: string;
}

export interface Reading {
  type: string; // "reading_1", "responsorial_psalm", "gospel", …
  reference: string; // reconstructed citation, e.g. "Wisdom 12:13, 16-19"
  verses: ReadingVerse[];
}

export interface DailyReadingsResponse {
  date: string;
  title?: string;
  lectionary?: string;
  lang: string;
  readings: Reading[];
}

// --- Liturgical calendar ----------------------------------------------------

export interface Celebration {
  id: string;
  name: string;
  rank: string; // "SOLEMNITY" | "FEAST" | "MEMORIAL" | "OPTIONAL_MEMORIAL" | "SUNDAY" | "WEEKDAY"
  rank_name: string; // localized, e.g. "Solemnity" / "memoria"
  colors: string[]; // "WHITE" | "RED" | "GREEN" | "PURPLE" | "ROSE" | "BLACK"
  season: string; // "ADVENT" | "CHRISTMAS_TIME" | "LENT" | "PASCHAL_TRIDUUM" | "EASTER_TIME" | "ORDINARY_TIME"
  season_name: string; // localized season name
  holy_day: boolean;
  optional: boolean;
  sanctoral: boolean; // true = santoral (saints), false = proper of time
  titles?: string[];
}

export interface CalendarDayResponse {
  date: string;
  lang: string;
  celebrations: Celebration[];
}

export interface CalendarYearResponse {
  year: number;
  lang: string;
  days: Record<string, Celebration[]>; // ISO date → celebrations
}
