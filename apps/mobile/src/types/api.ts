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
