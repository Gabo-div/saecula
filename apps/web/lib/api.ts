'use client'

import axios from 'axios'
import { useAuth } from './auth-store'
import type {
  AdminMeta,
  AuthResponse,
  EntitiesResponse,
  GraphData,
  GraphNode,
  LocalizedText,
  NodeDetail,
  NodesListResponse,
} from './types'
import type {
  BibleSearchResponse,
  BooksResponse,
  CalendarDayResponse,
  ChapterResponse,
  CatechismListResponse,
  CatechismSearchResponse,
  DailyReadingsResponse,
  DailyVerseResponse,
  TranslationsResponse,
} from './public-types'

export const api = axios.create({ baseURL: '' })

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== 'undefined') {
      useAuth.getState().clear()
      if (!window.location.pathname.startsWith('/admin/login')) {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  },
)

export const authApi = {
  async login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
    return data
  },
}

export const adminApi = {
  async meta(): Promise<AdminMeta> {
    const { data } = await api.get<AdminMeta>('/api/admin/graph/meta')
    return data
  },
  async graph(label: string, limit: number): Promise<GraphData> {
    const { data } = await api.get<GraphData>('/api/admin/graph', {
      params: { label, limit },
    })
    return data
  },
  async listNodes(label: string, q: string, limit: number): Promise<NodesListResponse> {
    const { data } = await api.get<NodesListResponse>('/api/admin/nodes', {
      params: { label, q, limit },
    })
    return data
  },
  async node(id: string): Promise<NodeDetail> {
    const { data } = await api.get<NodeDetail>(`/api/admin/nodes/${encodeURIComponent(id)}`)
    return data
  },
  async createNode(label: string, id: string, props: Record<string, unknown>): Promise<GraphNode> {
    const { data } = await api.post<GraphNode>('/api/admin/nodes', { label, id, props })
    return data
  },
  async updateNode(id: string, props: Record<string, unknown>): Promise<GraphNode> {
    const { data } = await api.patch<GraphNode>(`/api/admin/nodes/${encodeURIComponent(id)}`, { props })
    return data
  },
  async deleteNode(id: string): Promise<void> {
    await api.delete(`/api/admin/nodes/${encodeURIComponent(id)}`)
  },
  async createRelationship(source: string, target: string, type: string): Promise<void> {
    await api.post('/api/admin/relationships', { source, target, type })
  },
  async deleteRelationship(source: string, target: string, type: string): Promise<void> {
    await api.delete('/api/admin/relationships', { data: { source, target, type } })
  },
  async searchEntities(q: string, limit = 50): Promise<EntitiesResponse> {
    const { data } = await api.get<EntitiesResponse>('/api/admin/texts', { params: { q, limit } })
    return data
  },
  async textsForEntity(entityId: string): Promise<{ entity_id: string; texts: LocalizedText[] }> {
    const { data } = await api.get<{ entity_id: string; texts: LocalizedText[] }>(
      `/api/admin/texts/${encodeURIComponent(entityId)}`,
    )
    return data
  },
  async upsertText(entityId: string, doc: LocalizedText): Promise<void> {
    await api.put(`/api/admin/texts/${encodeURIComponent(entityId)}`, doc)
  },
  async deleteText(entityId: string, languageCode: string, translationId: string): Promise<void> {
    await api.delete(`/api/admin/texts/${encodeURIComponent(entityId)}`, {
      data: { language_code: languageCode, translation_id: translationId },
    })
  },
}

export function apiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.error
    if (typeof msg === 'string') return msg
    return error.message
  }
  if (error instanceof Error) return error.message
  return String(error)
}

export const publicApi = {
  async fetchBooks(lang = 'es'): Promise<BooksResponse> {
    const { data } = await api.get<BooksResponse>('/api/bible/books', { params: { lang } })
    return data
  },

  async fetchChapter(bookCode: string, chapter: number, lang = 'es'): Promise<ChapterResponse> {
    const { data } = await api.get<ChapterResponse>(`/api/bible/${bookCode}/${chapter}`, {
      params: { lang },
    })
    return data
  },

  async fetchTranslations(): Promise<TranslationsResponse> {
    const { data } = await api.get<TranslationsResponse>('/api/bible/translations')
    return data
  },

  async fetchDailyVerse(): Promise<DailyVerseResponse> {
    const { data } = await api.get<DailyVerseResponse>('/api/bible/daily')
    return data
  },

  async searchBible(q: string, lang = 'es', translation?: string): Promise<BibleSearchResponse> {
    const params: Record<string, string> = { q, lang }
    if (translation) params.translation = translation
    const { data } = await api.get<BibleSearchResponse>('/api/bible/search', { params })
    return data
  },

  async fetchCatechism(from: number, to?: number, limit = 50, lang = 'es'): Promise<CatechismListResponse> {
    const params: Record<string, string | number> = { from, limit, lang }
    if (to) params.to = to
    const { data } = await api.get<CatechismListResponse>('/api/catechism', { params })
    return data
  },

  async searchCatechism(q: string, lang = 'es'): Promise<CatechismSearchResponse> {
    const { data } = await api.get<CatechismSearchResponse>('/api/catechism/search', {
      params: { q, lang },
    })
    return data
  },

  async fetchDailyReadings(date?: string): Promise<DailyReadingsResponse> {
    const url = date ? `/api/readings/${date}` : '/api/readings'
    const { data } = await api.get<DailyReadingsResponse>(url)
    return data
  },

  async fetchCalendarDay(date?: string): Promise<CalendarDayResponse> {
    const url = date ? `/api/calendar/${date}` : '/api/calendar/today'
    const { data } = await api.get<CalendarDayResponse>(url)
    return data
  },
}
