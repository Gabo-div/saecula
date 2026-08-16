'use client'

import { useCallback, useEffect, useState } from 'react'
import { publicApi, apiErrorMessage } from '@/lib/api'
import type { DailyReadingsResponse } from '@/lib/public-types'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function formatDisplayDate(d: Date): string {
  return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export default function LecturasPage() {
  const [date, setDate] = useState(() => {
    const now = new Date()
    return formatDate(now)
  })
  const [readings, setReadings] = useState<DailyReadingsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (d: string) => {
    setLoading(true)
    setError(null)
    try {
      const data = await publicApi.fetchDailyReadings(d)
      setReadings(data)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(date)
  }, [date, load])

  const shiftDate = (delta: number) => {
    const d = new Date(date + 'T00:00:00')
    d.setUTCDate(d.getUTCDate() + delta)
    setDate(formatDate(d))
  }

  const displayDate = capitalize(formatDisplayDate(new Date(date + 'T00:00:00')))

  return (
    <div>
      <h1 className="reader-page-title">Lecturas del día</h1>

      <div className="reader-date-nav">
        <button onClick={() => shiftDate(-1)}>← Anterior</button>
        <span>{displayDate}</span>
        <button onClick={() => shiftDate(1)}>Siguiente →</button>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="reader-loading">Cargando lecturas...</div>
      ) : readings ? (
        <div>
          {readings.readings.map((r, ri) => (
            <div key={ri}>
              <div className="reader-reading-label">{r.label}</div>
              {r.verses.map((v, vi) => (
                <div key={vi}>
                  <div className="reader-reading-ref">{v.reference}</div>
                  <div className="reader-reading-text">{v.text}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="reader-empty">No hay lecturas para esta fecha.</div>
      )}
    </div>
  )
}
