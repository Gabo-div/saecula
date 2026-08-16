'use client'

import { useEffect, useState } from 'react'

interface PropsEditorProps {
  value: Record<string, unknown>
  onChange: (props: Record<string, unknown>, valid: boolean) => void
  disabled?: boolean
}

// JSON textarea for editing a node's properties. The value round-trips through
// JSON so devs edit the exact payload; null values delete a Neo4j property.
export default function PropsEditor({ value, onChange, disabled }: PropsEditorProps) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setText(JSON.stringify(value, null, 2))
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const t = e.target.value
    setText(t)
    if (t.trim() === '') {
      onChange({}, true)
      setError(null)
      return
    }
    try {
      const parsed = JSON.parse(t) as unknown
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('must be a JSON object')
      }
      onChange(parsed as Record<string, unknown>, true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'invalid JSON')
      onChange({}, false)
    }
  }

  return (
    <label>
      Props (JSON)
      <textarea value={text} onChange={handleChange} disabled={disabled} spellCheck={false} />
      {error && (
        <span className="status-line" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      )}
    </label>
  )
}
