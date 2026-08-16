'use client'

import { useState } from 'react'
import { adminApi, apiErrorMessage } from '@/lib/api'
import type { LocalizedText } from '@/lib/types'
import PropsEditor from './PropsEditor'

interface TextEditorProps {
  entityId: string
  texts: LocalizedText[]
  onChanged: () => void
}

type Draft = { raw_content: string; metadata: Record<string, unknown>; valid: boolean }

export default function TextEditor({ entityId, texts, onChanged }: TextEditorProps) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // New-translation form state.
  const [newLang, setNewLang] = useState('')
  const [newTrans, setNewTrans] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newMeta, setNewMeta] = useState<Record<string, unknown>>({})
  const [newMetaValid, setNewMetaValid] = useState(true)

  function keyOf(t: LocalizedText) {
    return `${t.language_code}\u0000${t.translation_id}`
  }

  function draft(t: LocalizedText): Draft {
    return (
      drafts[keyOf(t)] ?? {
        raw_content: t.raw_content,
        metadata: (t.metadata as Record<string, unknown>) ?? {},
        valid: true,
      }
    )
  }

  function setDraft(t: LocalizedText, patch: Partial<Draft>) {
    setDrafts((prev) => ({ ...prev, [keyOf(t)]: { ...draft(t), ...patch } }))
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function save(t: LocalizedText) {
    const d = draft(t)
    if (!d.valid) return
    await run(async () => {
      await adminApi.upsertText(entityId, {
        language_code: t.language_code,
        translation_id: t.translation_id,
        raw_content: d.raw_content,
        metadata: d.metadata,
      })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[keyOf(t)]
        return next
      })
      onChanged()
    })
  }

  async function addText() {
    if (!newLang.trim() || !newTrans.trim()) return
    if (!newMetaValid) return
    await run(async () => {
      await adminApi.upsertText(entityId, {
        language_code: newLang.trim(),
        translation_id: newTrans.trim(),
        raw_content: newContent,
        metadata: newMeta,
      })
      setNewLang('')
      setNewTrans('')
      setNewContent('')
      setNewMeta({})
      onChanged()
    })
  }

  async function remove(t: LocalizedText) {
    const ok = window.confirm(
      `Eliminar la traducción "${t.translation_id}" (${t.language_code}) de "${entityId}"?`,
    )
    if (!ok) return
    await run(async () => {
      await adminApi.deleteText(entityId, t.language_code, t.translation_id)
      onChanged()
    })
  }

  return (
    <div className="text-editor">
      {error && <div className="error">{error}</div>}

      {texts.map((t) => {
        const d = draft(t)
        return (
          <div className="card" key={keyOf(t)}>
            <div className="node-detail-head">
              <div>
                <h4>
                  <span className="labels">{t.language_code}</span> {t.translation_id}
                </h4>
              </div>
              <button
                className="btn btn-small btn-danger"
                onClick={() => remove(t)}
                disabled={busy}
              >
                Eliminar
              </button>
            </div>
            <div className="form-grid">
              <label className="span-2">
                Contenido
                <textarea
                  value={d.raw_content}
                  onChange={(e) => setDraft(t, { raw_content: e.target.value })}
                  rows={8}
                />
              </label>
              <div className="span-2">
                <PropsEditor
                  value={d.metadata}
                  onChange={(p, v) => setDraft(t, { metadata: p, valid: v })}
                />
              </div>
              <div className="btn-row span-2" style={{ gridColumn: '1 / -1' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => save(t)}
                  disabled={busy || !d.valid}
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {texts.length === 0 && (
        <div className="card">
          <p className="status-line">Este entidad no tiene traducciones registradas.</p>
        </div>
      )}

      <div className="card">
        <h4>Agregar traducción</h4>
        <div className="form-grid">
          <label>
            Idioma
            <input value={newLang} onChange={(e) => setNewLang(e.target.value)} placeholder="es" />
          </label>
          <label>
            Traducción
            <input
              value={newTrans}
              onChange={(e) => setNewTrans(e.target.value)}
              placeholder="biblia_rv1960"
            />
          </label>
          <label className="span-2">
            Contenido
            <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={6} />
          </label>
          <div className="span-2">
            <PropsEditor value={newMeta} onChange={(p, v) => {
              setNewMeta(p)
              setNewMetaValid(v)
            }} />
          </div>
          <div className="btn-row span-2" style={{ gridColumn: '1 / -1' }}>
            <button className="btn btn-primary" onClick={addText} disabled={busy || !newMetaValid}>
              Agregar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
