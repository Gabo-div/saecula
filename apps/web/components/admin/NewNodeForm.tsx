'use client'

import { useState } from 'react'
import { adminApi, apiErrorMessage } from '@/lib/api'

interface NewNodeFormProps {
  labels: string[]
  onCreated: (id: string) => void
  onCancel?: () => void
}

export default function NewNodeForm({ labels, onCreated, onCancel }: NewNodeFormProps) {
  const [label, setLabel] = useState(labels[0] ?? '')
  const [id, setId] = useState('')
  const [propsText, setPropsText] = useState('{}')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const parsed = JSON.parse(propsText) as Record<string, unknown>
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('props must be a JSON object')
      }
      const node = await adminApi.createNode(label, id.trim(), parsed)
      onCreated(node.id)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <h3>Nuevo nodo</h3>
      <div className="form-grid">
        <label>
          Label
          <select value={label} onChange={(e) => setLabel(e.target.value)} required>
            {labels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          ID
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="ej. timoteo"
            required
          />
        </label>
        <label className="span-2">
          Props (JSON)
          <textarea
            value={propsText}
            onChange={(e) => setPropsText(e.target.value)}
            spellCheck={false}
          />
        </label>
        {error && (
          <div className="error span-2" style={{ gridColumn: '1 / -1' }}>
            {error}
          </div>
        )}
        <div className="btn-row span-2" style={{ gridColumn: '1 / -1' }}>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? 'Creando…' : 'Crear'}
          </button>
          {onCancel && (
            <button className="btn" type="button" onClick={onCancel}>
              Cancelar
            </button>
          )}
        </div>
      </div>
    </form>
  )
}
