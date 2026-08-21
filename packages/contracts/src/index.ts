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
  date: string;
  book_code: string;
  book_name: string;
  chapter: number;
  reference: string;
  image_url?: string; // curated background; falls back to the app default
  verses: Verse[]; // one verse, or a range
  catechism_numbers: number[];
  catechism_paragraphs: { number: number; text: string }[];
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

// --- Catechism --------------------------------------------------------------

export interface CatechismParagraph {
  number: number;
  text: string;
}

export interface CatechismListResponse {
  lang: string;
  from: number;
  has_more: boolean;
  paragraphs: CatechismParagraph[];
}

// --- Search -----------------------------------------------------------------

export interface BibleSearchResult {
  book_code: string;
  book_name: string;
  chapter: number;
  verse: number;
  reference: string;
  text: string;
}

export interface BibleSearchResponse {
  query: string;
  results: BibleSearchResult[];
}

export interface CatechismSearchResult {
  number: number;
  snippet: string;
}

export interface CatechismSearchResponse {
  query: string;
  lang: string;
  results: CatechismSearchResult[];
}

// --- Chat (Ask) -------------------------------------------------------------

export interface ChatConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageMetadata {
  model?: string;
  toolCalls?: {
    name: string;
    input?: any;
    output?: any;
    ref?: string;
    status: 'started' | 'completed';
  }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: ChatMessageMetadata;
  created_at: string;
}

export interface ConversationResponse {
  conversation: ChatConversation;
  messages: ChatMessage[];
}

export interface ConversationsResponse {
  conversations: ChatConversation[];
}

// --- Streaks ---------------------------------------------------------------
export type ActivityType = 'bible' | 'readings' | 'prayer' | 'catechism';

export interface StreakResponse {
  current: number;
  best: number;
  lastActiveDay: string | null; // YYYY-MM-DD
  todayDone: boolean;
}

export interface CheckinRequest {
  date: string; // YYYY-MM-DD, client local day
  activityType: ActivityType;
}

export interface StreakHistoryEntry {
  day: string; // YYYY-MM-DD
  activityType: ActivityType;
}

export interface StreakHistoryResponse {
  entries: StreakHistoryEntry[];
}

// --- API keys ---------------------------------------------------------------
// Credentials for the public MCP endpoint, distinct from the app's session
// token: a key never expires, is revoked rather than deleted, and cannot be
// used against /api (nor a session token against /mcp).

export interface ApiKey {
  id: string;
  name: string;
  prefix: string; // non-secret leading fragment, e.g. "sk_saecula_Ab3dEf"
  created_at: string;
  total_calls: number;
  total_errors: number;
}

export interface ApiKeysResponse {
  keys: ApiKey[];
}

// CreatedApiKey is the only place the secret ever appears. It is not stored in
// recoverable form, so a key not copied here is lost and must be replaced.
export interface CreatedApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  key: string;
}

export interface ApiKeyUsageEntry {
  key_id: string;
  prefix: string;
  day: string; // YYYY-MM-DD, UTC
  tool: string;
  calls: number;
  errors: number;
}

export interface ApiKeyUsageResponse {
  usage: ApiKeyUsageEntry[];
}
