'use client'

import { useCallback, useEffect, useState } from 'react'
import { publicApi, apiErrorMessage } from '@/lib/api'
import type { CatechismParagraph, CatechismSearchResult } from '@/lib/public-types'

type Lang = 'es' | 'en' | 'la'

const CATECHISM_PARTS = [
  { label: { es: 'Prólogo', en: 'Prologue', la: 'Prooemium' }, from: 1, to: 25 },
  {
    label: { es: 'I — La Profesión de Fe', en: 'I — The Profession of Faith', la: 'I — Fides' },
    sections: [
      { label: { es: 'Dios', en: 'God', la: 'Deus' }, from: 26, to: 324 },
      { label: { es: 'Cristo', en: 'Christ', la: 'Christus' }, from: 325, to: 682 },
      { label: { es: 'El Espíritu Santo', en: 'The Holy Spirit', la: 'Spiritus Sanctus' }, from: 683, to: 1065 },
    ],
  },
  {
    label: { es: 'II — La Celebración del Misterio Cristiano', en: 'II — The Celebration of the Christian Mystery', la: 'II — Celebratio Mysterii Christiani' },
    sections: [
      { label: { es: 'Los sacramentos', en: 'The Sacraments', la: 'Sacramenta' }, from: 1066, to: 1666 },
      { label: { es: 'Los siete sacramentos', en: 'The Seven Sacraments', la: 'Septem Sacramenta' }, from: 1210, to: 1666 },
    ],
  },
  {
    label: { es: 'III — La Vida en Cristo', en: 'III — Life in Christ', la: 'III — Vita in Christo' },
    sections: [
      { label: { es: 'La dignidad de la persona humana', en: 'The Human Person', la: 'Persona Humana' }, from: 1691, to: 1876 },
      { label: { es: 'Los mandamientos', en: 'The Commandments', la: 'Mandata' }, from: 1877, to: 2557 },
    ],
  },
  {
    label: { es: 'IV — La Oración Cristiana', en: 'IV — Christian Prayer', la: 'IV — Oratio Christiana' },
    sections: [
      { label: { es: 'En la escuela de Jesús', en: 'In the School of Jesus', la: 'In Schola Iesu' }, from: 2558, to: 2865 },
    ],
  },
]

const LANG_LABELS: Record<Lang, string> = { es: 'Español', en: 'English', la: 'Latina' }

export default function CatechismPage() {
  const [lang, setLang] = useState<Lang>('es')
  const [from, setFrom] = useState(1)
  const [paragraphs, setParagraphs] = useState<CatechismParagraph[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CatechismSearchResult[]>([])
  const [searching, setSearching] = useState(false)

  const loadParagraphs = useCallback(async (start: number, l: Lang) => {
    setLoading(true)
    setError(null)
    try {
      const res = await publicApi.fetchCatechism(start, undefined, 80, l)
      setParagraphs(res.paragraphs)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadParagraphs(from, lang)
  }, [from, lang, loadParagraphs])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const res = await publicApi.searchCatechism(searchQuery.trim(), lang)
      setSearchResults(res.results)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setSearching(false)
    }
  }

  const jumpTo = (num: number) => {
    const part = CATECHISM_PARTS.find((p) => !p.sections && num >= p.from && num <= p.to)
    if (part && !part.sections) {
      setFrom(part.from)
    } else {
      setFrom(Math.max(1, num - 10))
    }
    setSearchResults([])
    setSearchQuery('')
  }

  return (
    <div>
      <h1 className="reader-page-title">Catecismo</h1>

      {/* Language tabs */}
      <div className="reader-lang-tabs">
        {(['es', 'en', 'la'] as Lang[]).map((l) => (
          <button
            key={l}
            className={`reader-lang-tab ${lang === l ? 'active' : ''}`}
            onClick={() => { setLang(l); setFrom(1) }}
          >
            {LANG_LABELS[l]}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="reader-controls">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar en el Catecismo..."
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
          {searchResults.map((r) => (
            <div key={r.number} className="reader-search-item" onClick={() => jumpTo(r.number)}>
              <div className="reader-search-ref">CCC {r.number}</div>
              <div className="reader-search-text" dangerouslySetInnerHTML={{ __html: r.text }} />
            </div>
          ))}
        </div>
      )}

      {/* Section navigation */}
      <div className="reader-controls" style={{ marginBottom: 24 }}>
        <select
          value={from}
          onChange={(e) => setFrom(Number(e.target.value))}
        >
          {CATECHISM_PARTS.map((part) =>
            part.sections ? (
              part.sections.map((s) => (
                <option key={s.from} value={s.from}>{s.label[lang]}</option>
              ))
            ) : (
              <option key={part.from} value={part.from}>{part.label[lang]}</option>
            )
          )}
        </select>
      </div>

      {/* Paragraphs */}
      {loading ? (
        <div className="reader-loading">Cargando...</div>
      ) : paragraphs.length > 0 ? (
        <div>
          {paragraphs.map((p) => (
            <p key={p.number} className="reader-catechism-p">
              <span className="reader-catechism-num">{p.number}</span>
              {p.text}
            </p>
          ))}
        </div>
      ) : (
        <div className="reader-empty">Selecciona una sección.</div>
      )}
    </div>
  )
}
