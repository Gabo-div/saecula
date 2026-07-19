import axios, { AxiosError } from 'axios';

import { useAuthStore } from '@/store/authStore';
import { useLanguageStore } from '@/store/languageStore';
import { useReaderStore } from '@/store/readerStore';
import type {
  AuthResponse,
  BooksResponse,
  ChapterResponse,
  DailyVerseResponse,
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
    params: bibleParams(),
  });
  return data;
}
