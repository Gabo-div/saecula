'use client'

import { useState } from 'react'
import { adminApi, apiErrorMessage } from '@/lib/api'
import type { NodeDetail } from '@/lib/types'
import PropsEditor from './PropsEditor'

interface NodeDetailPanelProps {
  detail: NodeDetail
  relTypes: string[]
  onChanged: () => void
  onDeleted: () => void
  onSelectNode: (id: string) => void
}

export default function NodeDetailPanel({
  detail,
  relTypes,
  onChanged,
  onDeleted,
  onSelectNode,
}: NodeDetailPanelProps) {
  const [props, setProps] = useState<Record<string, unknown>>(detail.props)
  const [propsValid, setPropsValid] = useState(true)
  const [connectTarget, setConnectTarget] = useState('')
  const [connectType, setConnectType] = useState(relTypes[0] ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  async function saveProps() {
    if (!propsValid) return
    await run(async () => {
      await adminApi.updateNode(detail.id, props)
      onChanged()
    })
  }

  async function connect() {
    if (!connectTarget.trim()) return
    await run(async () => {
      await adminApi.createRelationship(detail.id, connectTarget.trim(), connectType)
      setConnectTarget('')
      onChanged()
    })
  }

  async function deleteRelationship(rel: { source: string; target: string; type: string }) {
    await run(async () => {
      await adminApi.deleteRelationship(rel.source, rel.target, rel.type)
      onChanged()
    })
  }

  async function deleteNode() {
    const ok = window.confirm(`Eliminar el nodo "${detail.id}" y todas sus relaciones?`)
    if (!ok) return
    await run(async () => {
      await adminApi.deleteNode(detail.id)
      onDeleted()
    })
  }

  return (
    <div className="card node-detail">
      <div className="node-detail-head">
        <div>
          <h3>{detail.id}</h3>
          <span className="labels">{detail.labels.join(', ')}</span>
        </div>
        <button className="btn btn-danger btn-small" onClick={deleteNode} disabled={busy}>
          Eliminar
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      <PropsEditor value={props} onChange={(p, v) => {
        setProps(p)
        setPropsValid(v)
      }} />
      <div className="btn-row">
        <button className="btn btn-primary" onClick={saveProps} disabled={busy || !propsValid}>
          Guardar props
        </button>
      </div>

      <section className="sub-block">
        <h4>Conectar con otro nodo</h4>
        <div className="form-row">
          <input
            value={connectTarget}
            onChange={(e) => setConnectTarget(e.target.value)}
            placeholder="ID del nodo destino"
          />
          <select value={connectType} onChange={(e) => setConnectType(e.target.value)}>
            {relTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={connect} disabled={busy}>
            Crear relación
          </button>
        </div>
      </section>

      <section className="sub-block">
        <h4>Vecinos ({detail.neighbors.length})</h4>
        {detail.neighbors.length === 0 ? (
          <p className="status-line">Sin relaciones.</p>
        ) : (
          <ul className="neighbor-list">
            {detail.neighbors.map((n, i) => (
              <li key={i}>
                <span className="labels">{n.type}</span>
                <button className="link-like" onClick={() => onSelectNode(n.neighbor_id)}>
                  {n.neighbor_id}
                </button>
                <button
                  className="btn btn-small btn-ghost"
                  onClick={() => deleteRelationship({ source: n.source, target: n.target, type: n.type })}
                  disabled={busy}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
