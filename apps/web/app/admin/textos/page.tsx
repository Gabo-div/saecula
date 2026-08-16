'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi, apiErrorMessage } from '@/lib/api'
import type { LocalizedText } from '@/lib/types'
import TextEditor from '@/components/admin/TextEditor'

export default function TextsPage() {
  const [q, setQ] = useState('')
  const [query, setQuery] = useState('')
  const [entities, setEntities] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [texts, setTexts] = useState<LocalizedText[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (searchQuery: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.searchEntities(searchQuery, 100)
      setEntities(res.entities)
    } catch (err) {
      setError(apiErrorMessage(err))
      setEntities([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadTexts = useCallback(async (entityId: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.textsForEntity(entityId)
      setTexts(res.texts)
    } catch (err) {
      setError(apiErrorMessage(err))
      setTexts([])
    } finally {
      setLoading(false)
    }
  }, [])

  async function openEntity(entityId: string) {
    setSelected(entityId)
    await loadTexts(entityId)
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    setQuery(trimmed)
    if (trimmed) search(trimmed)
  }

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1>Textos</h1>
        <form className="toolbar" onSubmit={submitSearch}>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar entidades (ej. juan 3, catecismo 2015)"
          />
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="texts-layout">
        <div className="card table-card">
          <h3>Entidades</h3>
          {entities.length === 0 && query === '' && (
            <p className="status-line">Escribe un término para buscar entidades con textos.</p>
          )}
          {entities.length === 0 && query !== '' && !loading && (
            <p className="status-line">Sin resultados para “{query}”.</p>
          )}
          <ul className="entity-list">
            {entities.map((id) => (
              <li
                key={id}
                className={id === selected ? 'row-selected' : ''}
                onClick={() => openEntity(id)}
              >
                {id}
              </li>
            ))}
          </ul>
        </div>
        <div className="detail-col">
          {selected ? (
            <div>
              <h3 className="entity-title">Traducciones de “{selected}”</h3>
              <TextEditor entityId={selected} texts={texts} onChanged={() => loadTexts(selected)} />
            </div>
          ) : (
            <div className="card">
              <p className="status-line">Selecciona una entidad de la lista.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
