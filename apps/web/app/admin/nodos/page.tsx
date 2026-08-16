'use client'

import { useCallback, useEffect, useState } from 'react'
import { adminApi, apiErrorMessage } from '@/lib/api'
import type { AdminMeta, GraphNode, NodeDetail } from '@/lib/types'
import NodeDetailPanel from '@/components/admin/NodeDetailPanel'
import NewNodeForm from '@/components/admin/NewNodeForm'

export default function NodesPage() {
  const [meta, setMeta] = useState<AdminMeta | null>(null)
  const [nodes, setNodes] = useState<GraphNode[]>([])
  const [label, setLabel] = useState('')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(200)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<NodeDetail | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const loadMeta = useCallback(async () => {
    try {
      setMeta(await adminApi.meta())
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }, [])

  const loadNodes = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.listNodes(label, q, limit)
      setNodes(res.nodes)
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [label, q, limit])

  const openDetail = useCallback(async (id: string) => {
    setSelected(id)
    setError(null)
    try {
      setDetail(await adminApi.node(id))
    } catch (err) {
      setError(apiErrorMessage(err))
      setDetail(null)
    }
  }, [])

  useEffect(() => {
    loadMeta()
  }, [loadMeta])

  useEffect(() => {
    loadNodes()
  }, [loadNodes])

  async function reloadDetail() {
    if (selected) await openDetail(selected)
    await loadNodes()
  }

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1>Nodos</h1>
        <div className="toolbar">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (opcional)"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por ID o props"
          />
          <input
            type="number"
            value={limit}
            min={10}
            max={2000}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
          <button className="btn btn-primary" onClick={loadNodes} disabled={loading}>
            {loading ? 'Cargando…' : 'Buscar'}
          </button>
          <button className="btn" onClick={() => setShowNew((v) => !v)}>
            {showNew ? 'Cancelar' : '+ Nuevo nodo'}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {showNew && meta && (
        <NewNodeForm
          labels={meta.labels}
          onCreated={async (id) => {
            setShowNew(false)
            await loadNodes()
            await openDetail(id)
          }}
          onCancel={() => setShowNew(false)}
        />
      )}

      <div className="nodes-layout">
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Labels</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr
                  key={n.id}
                  className={n.id === selected ? 'row-selected' : ''}
                  onClick={() => openDetail(n.id)}
                >
                  <td>{n.id}</td>
                  <td>{n.labels.join(', ')}</td>
                </tr>
              ))}
              {nodes.length === 0 && (
                <tr>
                  <td colSpan={2} className="status-line">
                    Sin resultados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="detail-col">
          {detail ? (
            <NodeDetailPanel
              detail={detail}
              relTypes={meta?.rel_types ?? []}
              onChanged={reloadDetail}
              onDeleted={() => {
                setSelected(null)
                setDetail(null)
                loadNodes()
              }}
              onSelectNode={openDetail}
            />
          ) : (
            <div className="card">
              <p className="status-line">Selecciona un nodo de la tabla.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
