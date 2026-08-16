export type LanguageCode = 'en' | 'es' | 'la';

export interface Book {
  code: string;
  name: string;
  chapters: number;
}

export interface BooksResponse {
  lang: string;
  books: Book[];
}

export interface Verse {
  book_code: string;
  chapter: number;
  number: number;
  text: string;
}

export interface ChapterResponse {
  lang: string;
  book_code: string;
  chapter: number;
  verses: Verse[];
}

export interface Translation {
  id: string;
  name: string;
  lang: string;
  book_count: number;
}

export interface TranslationsResponse {
  translations: Translation[];
}

export interface DailyVerseResponse {
  date: string;
  book_code: string;
  chapter: number;
  reference: string;
  verses: Verse[];
  catechism_paragraphs?: { number: number; text: string }[];
  image_url?: string;
}

export interface BibleSearchResult {
  book_code: string;
  chapter: number;
  verse: number;
  text: string;
  translation_id: string;
}

export interface BibleSearchResponse {
  query: string;
  lang: string;
  count: number;
  results: BibleSearchResult[];
}

export interface CatechismParagraph {
  number: number;
  text: string;
  lang: string;
}

export interface CatechismListResponse {
  lang: string;
  count: number;
  paragraphs: CatechismParagraph[];
}

export interface CatechismSearchResult {
  number: number;
  text: string;
}

export interface CatechismSearchResponse {
  query: string;
  lang: string;
  count: number;
  results: CatechismSearchResult[];
}

export interface ReadingVerse {
  type: string;
  reference: string;
  text: string;
}

export interface Reading {
  label: string;
  verses: ReadingVerse[];
}

export interface DailyReadingsResponse {
  date: string;
  readings: Reading[];
}

export interface Celebration {
  id: string;
  name: string;
  rank_name: string;
  season_name: string;
  colors: string[];
  sanctoral: boolean;
}

export interface CalendarDayResponse {
  date: string;
  season: string;
  celebrations: Celebration[];
}
