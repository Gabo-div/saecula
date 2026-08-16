'use client'

import { useEffect, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import type { NodeObject } from 'react-force-graph-2d'
import type { GraphData } from '@/lib/types'

interface ForceGraphCanvasProps {
  graph: GraphData
  highlightedId: string | null
  onNodeClick: (id: string) => void
}

const PALETTE = [
  '#e8a33d',
  '#5aa9e6',
  '#7bcb6a',
  '#d96b8e',
  '#9b7bd4',
  '#5bc8c8',
  '#e6e05a',
  '#f28d8d',
]

function colorForLabels(labels: string[]): string {
  if (labels.length === 0) return PALETTE[0]
  let h = 0
  for (const l of labels) for (const ch of l) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return PALETTE[h % PALETTE.length]
}

// Canvas renderer for the force graph (react-force-graph). Must stay SSR-off,
// hence it is only imported through next/dynamic in the page.
export default function ForceGraphCanvas({ graph, highlightedId, onNodeClick }: ForceGraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="graph-canvas">
      <ForceGraph2D
        width={size.w}
        height={size.h}
        graphData={graph}
        nodeLabel={(n: NodeObject) => String(n.id)}
        nodeColor={(n: NodeObject) => colorForLabels((n as { labels?: string[] }).labels ?? [])}
        nodeCanvasObject={(node: NodeObject, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const id = String(node.id)
          const labels = (node as { labels?: string[] }).labels ?? []
          const r = highlightedId === id ? 7 : 4
          ctx.beginPath()
          ctx.arc(node.x!, node.y!, r, 0, 2 * Math.PI)
          ctx.fillStyle = colorForLabels(labels)
          if (highlightedId === id) {
            ctx.strokeStyle = '#f2ead9'
            ctx.lineWidth = 2 / globalScale
            ctx.stroke()
          }
          ctx.fill()
          const fontSize = 11 / globalScale
          ctx.font = `${fontSize}px Sans-Serif`
          ctx.fillStyle = '#e9e2d2'
          ctx.fillText(id, node.x! + r + 2, node.y! - r)
        }}
        onNodeClick={(node: NodeObject) => onNodeClick(String(node.id))}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkColor={() => '#5a4a2c'}
        backgroundColor="rgba(0,0,0,0)"
        cooldownTicks={100}
      />
    </div>
  )
}
