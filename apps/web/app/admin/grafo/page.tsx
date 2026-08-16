'use client'

import { useCallback, useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { adminApi, apiErrorMessage } from '@/lib/api'
import type { AdminMeta, GraphData, NodeDetail } from '@/lib/types'
import NodeDetailPanel from '@/components/admin/NodeDetailPanel'

const ForceGraphCanvas = dynamic(() => import('@/components/admin/ForceGraphCanvas'), {
  ssr: false,
})

export default function GraphPage() {
  const [meta, setMeta] = useState<AdminMeta | null>(null)
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [label, setLabel] = useState('')
  const [limit, setLimit] = useState(400)
  const [detail, setDetail] = useState<NodeDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const [relType, setRelType] = useState('')

  const loadMeta = useCallback(async () => {
    try {
      const m = await adminApi.meta()
      setMeta(m)
      setRelType((prev) => prev || m.rel_types[0] || '')
    } catch (err) {
      setError(apiErrorMessage(err))
    }
  }, [])

  const loadGraph = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setGraph(await adminApi.graph(label, limit))
    } catch (err) {
      setError(apiErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [label, limit])

  const openDetail = useCallback(async (id: string) => {
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
    loadGraph()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit])

  async function handleNodeClick(id: string) {
    if (linkFrom) {
      if (linkFrom === id) return
      const type = relType || (meta?.rel_types[0] ?? '')
      setError(null)
      try {
        await adminApi.createRelationship(linkFrom, id, type)
        setLinkFrom(null)
        setDetail(await adminApi.node(id))
        await loadGraph()
      } catch (err) {
        setError(apiErrorMessage(err))
      }
    } else {
      await openDetail(id)
    }
  }

  async function reloadDetail() {
    if (detail) await openDetail(detail.id)
    await loadGraph()
  }

  return (
    <div className="page-stack">
      <div className="page-head">
        <h1>Grafo</h1>
        <div className="toolbar">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Filtro por label (opcional)"
          />
          <input
            type="number"
            value={limit}
            min={10}
            max={5000}
            onChange={(e) => setLimit(Number(e.target.value))}
            title="Máximo de nodos"
          />
          <button className="btn btn-primary" onClick={loadGraph} disabled={loading}>
            {loading ? 'Cargando…' : 'Cargar'}
          </button>
          <button
            className={`btn ${linkFrom ? 'btn-primary' : ''}`}
            onClick={() => setLinkFrom(linkFrom ? null : '')}
          >
            {linkFrom ? 'Cancelar enlace' : 'Enlazar nodos'}
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      {linkFrom && (
        <div className="toolbar link-prompt">
          <span className="status-line">
            Elige el nodo destino para enlazar desde <strong>{linkFrom}</strong>
          </span>
          <select value={relType} onChange={(e) => setRelType(e.target.value)}>
            {(meta?.rel_types ?? []).map((t: string) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      {graph && (
        <div className="graph-layout">
          <div className="graph-box">
            <ForceGraphCanvas
              graph={graph}
              highlightedId={detail?.id ?? null}
              onNodeClick={handleNodeClick}
            />
            <p className="status-line">
              {graph.nodes.length} nodos · {graph.links.length} relaciones
            </p>
          </div>
          <div className="detail-col">
            {detail ? (
              <NodeDetailPanel
                detail={detail}
                relTypes={meta?.rel_types ?? []}
                onChanged={reloadDetail}
                onDeleted={() => {
                  setDetail(null)
                  loadGraph()
                }}
                onSelectNode={openDetail}
              />
            ) : (
              <div className="card">
                <p className="status-line">Selecciona un nodo para ver su detalle.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
