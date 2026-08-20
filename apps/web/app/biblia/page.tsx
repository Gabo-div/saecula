'use client'

import { useCallback, useEffect, useState } from 'react'
import { publicApi, apiErrorMessage } from '@/lib/api'
import type { Book, ChapterResponse, Translation, BibleSearchResult } from '@/lib/public-types'

export default function BiblePage() {
  const [books, setBooks] = useState<Book[]>([])
  const [translations, setTranslations] = useState<Translation[]>([])
  const [selectedBook, setSelectedBook] = useState<string>('GEN')
  const [selectedChapter, setSelectedChapter] = useState<number>(1)
  const [selectedTranslation, setSelectedTranslation] = useState<string>('')
  const [chapter, setChapter] = useState<ChapterResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<BibleSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    void publicApi.fetchTranslations().then((res) => {
      setTranslations(res.translations)
      if (res.translations.length > 0 && !selectedTranslation) {
        setSelectedTranslation(res.translations[0].id)
      }
    }).catch(() => {})
  }, [selectedTranslation])

  // Book catalog reloads with the edition so book names track the version.
  useEffect(() => {
    void publicApi
      .fetchBooks('es', selectedTranslation || undefined)
      .then((res) => setBooks(res.books))
      .catch(() => {})
  }, [selectedTranslation])

  const loadChapter = useCallback(
    async (book: string, ch: number) => {
      setLoading(true)
      setError(null)
      try {
        const data = await publicApi.fetchChapter(book, ch, 'es', selectedTranslation || undefined)
        setChapter(data)
      } catch (err) {
        setError(apiErrorMessage(err))
      } finally {
        setLoading(false)
      }
    },
    [selectedTranslation],
  )

  useEffect(() => {
    void loadChapter(selectedBook, selectedChapter)
  }, [selectedBook, selectedChapter, loadChapter])

  const currentBook = books.find((b) => b.code === selectedBook)
  const chapters = currentBook ? Array.from({ length: currentBook.chapters }, (_, i) => i + 1) : []

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await publicApi.searchBible(searchQuery.trim(), 'es', selectedTranslation || undefined)
      setSearchResults(res.results)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSearching(false)
    }
  }

  const jumpToResult = (r: BibleSearchResult) => {
    setSelectedBook(r.book_code)
    setSelectedChapter(r.chapter)
    setSearchResults([])
    setSearchQuery('')
  }

  const navigateChapter = (delta: number) => {
    const next = selectedChapter + delta
    if (next >= 1 && currentBook && next <= currentBook.chapters) {
      setSelectedChapter(next)
    }
  }

  return (
    <div>
      <h1 className="reader-page-title">Biblia</h1>

      {/* Book / chapter picker */}
      <div className="reader-controls">
        <select
          value={selectedBook}
          onChange={(e) => {
            setSelectedBook(e.target.value)
            setSelectedChapter(1)
          }}
        >
          {books.map((b) => (
            <option key={b.code} value={b.code}>{b.name}</option>
          ))}
        </select>

        <select
          value={selectedChapter}
          onChange={(e) => setSelectedChapter(Number(e.target.value))}
        >
          {chapters.map((ch) => (
            <option key={ch} value={ch}>{ch}</option>
          ))}
        </select>

        <select
          value={selectedTranslation}
          onChange={(e) => setSelectedTranslation(e.target.value)}
        >
          {translations.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Search */}
      <div className="reader-controls">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar en la Biblia..."
          onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
          style={{ flex: 1 }}
        />
        <button onClick={() => void handleSearch()} disabled={searching}>
          {searching ? 'Buscando...' : 'Buscar'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="reader-search-results" style={{ marginBottom: 24 }}>
          {searchResults.map((r, i) => (
            <div key={i} className="reader-search-item" onClick={() => jumpToResult(r)}>
              <div className="reader-search-ref">{r.book_code} {r.chapter}:{r.verse}</div>
              <div className="reader-search-text" dangerouslySetInnerHTML={{ __html: r.text }} />
            </div>
          ))}
        </div>
      )}

      {/* Chapter nav */}
      <div className="reader-date-nav" style={{ marginBottom: 16 }}>
        <button onClick={() => navigateChapter(-1)} disabled={selectedChapter <= 1}>
          ← Anterior
        </button>
        <span>{currentBook?.name} {selectedChapter}</span>
        <button
          onClick={() => navigateChapter(1)}
          disabled={!currentBook || selectedChapter >= currentBook.chapters}
        >
          Siguiente →
        </button>
      </div>

      {/* Chapter content */}
      {loading ? (
        <div className="reader-loading">Cargando...</div>
      ) : chapter ? (
        <div className="reader-chapter">
          {chapter.verses.map((v) => (
            <span key={v.number} className="reader-verse">
              <span className="reader-verse-num">{v.number}</span>
              {v.text}{' '}
            </span>
          ))}
        </div>
      ) : (
        <div className="reader-empty">Selecciona un libro y capítulo.</div>
      )}
    </div>
  )
}
