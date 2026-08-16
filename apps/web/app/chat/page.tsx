'use client'

import { useCallback, useRef, useState } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  id: string
}

function parseFrame(frame: string): { event: string; data: string } {
  let event = ''
  const data: string[] = []
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
  }
  return { event, data: data.join('\n') }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState(false)
  const convId = useRef<string | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)

  const send = useCallback(async (text?: string) => {
    const message = (text ?? input).trim()
    if (!message || streaming) return
    setInput('')
    setError(false)

    const userMsg: Message = { role: 'user', content: message, id: `user-${Date.now()}` }
    setMessages((prev) => [...prev, userMsg])

    setStreaming(true)
    const ctrl = new AbortController()
    abortRef.current = ctrl
    let acc = ''

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation_id: convId.current,
          message,
          lang: 'es',
        }),
        signal: ctrl.signal,
      })

      if (!res.ok) {
        setError(true)
        setStreaming(false)
        return
      }

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let result: { conversation_id?: string; message_id?: string } | null = null

      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        let sep: number
        while ((sep = buf.indexOf('\n\n')) !== -1) {
          const { event, data } = parseFrame(buf.slice(0, sep))
          buf = buf.slice(sep + 2)
          if (!event || !data) continue
          const payload = JSON.parse(data)
          if (event === 'token') {
            acc += payload.text ?? ''
            setMessages((prev) => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, content: acc }
              } else {
                next.push({ role: 'assistant', content: acc, id: `assistant-${Date.now()}` })
              }
              return next
            })
          } else if (event === 'done') {
            result = payload
          }
        }
      }

      if (result) {
        convId.current = result.conversation_id
      }
    } catch {
      if (!ctrl.signal.aborted) setError(true)
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }, [input, streaming])

  const newChat = () => {
    convId.current = undefined
    setMessages([])
    setError(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '0 0 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="reader-page-title" style={{ marginBottom: 0 }}>Preguntar</h1>
          <button onClick={newChat} style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: '6px 14px',
            color: 'var(--text)',
            cursor: 'pointer',
          }}>
            Nueva conversación
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'auto', paddingBottom: 100 }}>
        {messages.length === 0 && !streaming && (
          <div className="reader-empty" style={{ paddingTop: 80 }}>
            <p style={{ fontSize: '1.1rem', color: 'var(--muted)' }}>
              Pregunta sobre la Biblia, el Catecismo, los Santos y más.
            </p>
          </div>
        )}

        <div className="reader-chat-messages">
          {messages.map((m, i) => (
            <div key={i} className={`reader-chat-msg ${m.role}`}>
              {m.content}
            </div>
          ))}
          {streaming && messages.length === 0 && (
            <div className="reader-chat-msg assistant" style={{ color: 'var(--muted)' }}>
              Pensando...
            </div>
          )}
        </div>

        {error && (
          <div style={{ textAlign: 'center', padding: 12 }}>
            <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Error al enviar. </span>
            <span
              style={{ color: 'var(--accent)', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer' }}
              onClick={() => void send()}
            >
              Reintentar
            </span>
          </div>
        )}
      </div>

      <div className="reader-chat-input-bar">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && void send()}
          placeholder="Escribe tu pregunta..."
          disabled={streaming}
        />
        <button onClick={() => void send()} disabled={!input.trim() || streaming}>
          {streaming ? '...' : 'Enviar'}
        </button>
      </div>
    </div>
  )
}
