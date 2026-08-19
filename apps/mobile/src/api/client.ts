import axios, { AxiosError } from 'axios';

import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderStore } from '@/store/readerStore';
import type {
  ActivityType,
  AuthResponse,
  BooksResponse,
  CalendarDayResponse,
  CalendarYearResponse,
  BibleSearchResponse,
  CatechismListResponse,
  CatechismSearchResponse,
  ChapterResponse,
  DailyReadingsResponse,
  DailyVerseResponse,
  SavedVersesResponse,
  SavedVerse,
  StreakHistoryResponse,
  StreakResponse,
  ActivityType,
  TimelineResponse,
  TranslationsResponse,
} from '@/types/api';

// Backend URL comes from .env (EXPO_PUBLIC_API_URL — Expo loads .env files
// natively and inlines EXPO_PUBLIC_* at bundle time). Default: localhost.
// On a physical device localhost is the phone itself — set your machine's
// LAN IP in .env. Changing .env requires restarting `expo start`.
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

if (__DEV__) {
  console.log(`[api] base URL: ${API_BASE_URL} `);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

// Dev-only request/response logging: every call prints its final URL and
// outcome, so "Connection failed" always has a traceable cause in the
// Metro/browser console.
if (__DEV__) {
  api.interceptors.request.use((config) => {
    const method = (config.method ?? 'get').toUpperCase();
    console.log(`[api] → ${method} ${config.baseURL}${config.url}`);
    return config;
  });
  api.interceptors.response.use(
    (response) => {
      const method = (response.config.method ?? 'get').toUpperCase();
      console.log(`[api] ← ${response.status} ${method} ${response.config.url}`);
      return response;
    },
    (error: AxiosError) => {
      const cfg = error.config;
      const method = (cfg?.method ?? 'get').toUpperCase();
      const target = `${cfg?.baseURL ?? ''}${cfg?.url ?? ''}`;
      if (error.response) {
        console.log(
          `[api] ← ${error.response.status} ${method} ${target}`,
          JSON.stringify(error.response.data),
        );
      } else {
        // No HTTP response at all: DNS/route/firewall/CORS/timeout.
        console.log(`[api] ✕ ${method} ${target} — ${error.code ?? 'NO_RESPONSE'}: ${error.message}`);
      }
      return Promise.reject(error);
    },
  );
}

// Attach the Bearer token to every outgoing request when a session exists.
api.interceptors.request.use((config) => {
  const { token } = useAuthStore.getState();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A 401 means the token expired or was revoked — drop the local session so
// the UI falls back to the login screen.
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  },
);

// ---------------------------------------------------------------------------
// Typed endpoint wrappers
// ---------------------------------------------------------------------------

export async function register(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', { email, password });
  useAuthStore.getState().setSession(data.token, data.expires_at, data.user);
  return data;
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { email, password });
  useAuthStore.getState().setSession(data.token, data.expires_at, data.user);
  return data;
}

export async function fetchTimeline(startYear: number, endYear: number): Promise<TimelineResponse> {
  const { language } = useLanguageStore.getState();
  const { translationId } = useReaderStore.getState();

  const { data } = await api.get<TimelineResponse>('/api/timeline', {
    params: {
      start_year: startYear,
      end_year: endYear,
      lang: language,
      ...(translationId ? { translation: translationId } : {}),
    },
  });
  return data;
}

// --- Bible ------------------------------------------------------------------

function bibleParams(): Record<string, string> {
  const { language } = useLanguageStore.getState();
  const { translationId } = useReaderStore.getState();
  return {
    lang: language,
    ...(translationId ? { translation: translationId } : {}),
  };
}

// todayLocalISO formats the device's local date as YYYY-MM-DD, so "today"
// rolls over at the user's own midnight rather than the server's UTC one.
export function todayLocalISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export async function fetchBooks(): Promise<BooksResponse> {
  const { data } = await api.get<BooksResponse>('/api/bible/books', {
    params: { lang: useLanguageStore.getState().language },
  });
  return data;
}

export async function fetchChapter(bookCode: string, chapter: number): Promise<ChapterResponse> {
  const { data } = await api.get<ChapterResponse>(
    `/api/bible/${encodeURIComponent(bookCode)}/${chapter}`,
    { params: bibleParams() },
  );
  return data;
}

export async function fetchTranslations(): Promise<TranslationsResponse> {
  const { data } = await api.get<TranslationsResponse>('/api/bible/translations');
  return data;
}

export async function fetchDailyVerse(): Promise<DailyVerseResponse> {
  const { data } = await api.get<DailyVerseResponse>('/api/bible/daily', {
    params: { ...bibleParams(), date: todayLocalISO() },
  });
  return data;
}

// --- Daily readings ---------------------------------------------------------

// fetchDailyReadings loads the Mass readings for a date (ISO YYYY-MM-DD),
// defaulting to today when omitted. Reuses bibleParams so a pinned
// translation and the UI language flow through identically.
export async function fetchDailyReadings(date?: string): Promise<DailyReadingsResponse> {
  const path = date ? `/api/readings/${date}` : `/api/readings/${todayLocalISO()}`;
  const { data } = await api.get<DailyReadingsResponse>(path, { params: bibleParams() });
  return data;
}

// --- Liturgical calendar ----------------------------------------------------

// A gregorian year's calendar never changes, so cache it per year+language.
// The santoral and celebrations screens both flip through months of the same
// year and read the same payload — this keeps them to one request each.
const calendarYearCache = new Map<string, CalendarYearResponse>();

// fetchCalendarYear loads the whole General Roman calendar for a gregorian
// year; the santoral and celebrations screens filter it client-side.
export async function fetchCalendarYear(year: number): Promise<CalendarYearResponse> {
  const lang = useLanguageStore.getState().language;
  const key = `${lang}:${year}`;
  const cached = calendarYearCache.get(key);
  if (cached) return cached;

  const { data } = await api.get<CalendarYearResponse>(`/api/calendar/year/${year}`, {
    params: { lang },
  });
  calendarYearCache.set(key, data);
  return data;
}

// fetchCalendarDay loads the celebrations for a single date (ISO YYYY-MM-DD),
// defaulting to the device's local date when omitted.
export async function fetchCalendarDay(date?: string): Promise<CalendarDayResponse> {
  const path = date ? `/api/calendar/${date}` : `/api/calendar/${todayLocalISO()}`;
  const { data } = await api.get<CalendarDayResponse>(path, {
    params: { lang: useLanguageStore.getState().language },
  });
  return data;
}

// --- Catechism --------------------------------------------------------------

// fetchCatechism loads a page of CCC paragraphs from `from`, optionally capped
// at `to` (to scope a request to one part), in the given language edition.
export async function fetchCatechism(
  from: number,
  to?: number,
  limit = 50,
  lang = 'en',
): Promise<CatechismListResponse> {
  const { data } = await api.get<CatechismListResponse>('/api/catechism', {
    params: { from, limit, lang, ...(to ? { to } : {}) },
  });
  return data;
}

export async function searchBible(
  q: string,
  lang: string,
  translation?: string,
): Promise<BibleSearchResponse> {
  const { data } = await api.get<BibleSearchResponse>('/api/bible/search', {
    params: { q, lang, ...(translation ? { translation } : {}) },
  });
  return data;
}

export async function searchCatechism(q: string, lang: string): Promise<CatechismSearchResponse> {
  const { data } = await api.get<CatechismSearchResponse>('/api/catechism/search', {
    params: { q, lang },
  });
  return data;
}

// --- Streaks ----------------------------------------------------------------

export async function checkinStreak(activityType: ActivityType): Promise<StreakResponse> {
  const { data } = await api.post<StreakResponse>('/api/streak/checkin', {
    date: todayLocalISO(),
    activityType,
  });
  return data;
}

export async function fetchStreak(): Promise<StreakResponse> {
  const { data } = await api.get<StreakResponse>('/api/streak', {
    params: { date: todayLocalISO() },
  });
  return data;
}

export async function fetchStreakHistory(
  from: string,
  to: string,
): Promise<StreakHistoryResponse> {
  const { data } = await api.get<StreakHistoryResponse>('/api/streak/history', {
    params: { from, to },
  });
  return data;
}

// --- Bookmarks / Saved Verses ------------------------------------------------

export async function fetchSavedVerses(filter?: string): Promise<SavedVersesResponse> {
  const { data } = await api.get<SavedVersesResponse>('/api/bookmarks', {
    params: filter ? { filter } : {},
  });
  return data;
}

export async function getSavedVerse(entityId: string): Promise<SavedVerse | null> {
  try {
    const { data } = await api.get<SavedVerse>(
      `/api/bookmarks/${encodeURIComponent(entityId)}`,
    );
    return data;
  } catch {
    return null;
  }
}

export async function saveVerse(payload: {
  entity_id: string;
  reference: string;
  verse_text: string;
  highlight_color?: string | null;
  note?: string | null;
}): Promise<SavedVerse> {
  const { data } = await api.post<SavedVerse>('/api/bookmarks', payload);
  return data;
}

export async function setHighlight(
  entityId: string,
  color: string | null,
): Promise<void> {
  await api.put(
    `/api/bookmarks/${encodeURIComponent(entityId)}/highlight`,
    { color },
  );
}

export async function setNote(
  entityId: string,
  note: string | null,
): Promise<void> {
  await api.put(
    `/api/bookmarks/${encodeURIComponent(entityId)}/note`,
    { note },
  );
}

export async function deleteSavedVerse(entityId: string): Promise<void> {
  await api.delete(`/api/bookmarks/${encodeURIComponent(entityId)}`);
}
