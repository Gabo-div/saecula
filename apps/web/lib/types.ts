// Response shapes from the Go backend (mirrors apps/back responses).

export interface AuthResponse {
  token: string
  expires_at: string
  user: { id: string; email: string; role: string }
}

export interface AdminMeta {
  labels: string[]
  rel_types: string[]
}

export interface GraphNode {
  id: string
  labels: string[]
  props: Record<string, unknown>
}

export interface GraphLink {
  source: string
  target: string
  type: string
}

export interface GraphData {
  label: string
  limit: number
  count: number
  nodes: GraphNode[]
  links: GraphLink[]
}

export interface Neighbor {
  source: string
  target: string
  type: string
  props?: Record<string, unknown>
  direction: 'in' | 'out'
  neighbor_id: string
  neighbor_labels: string[]
}

export interface NodeDetail extends GraphNode {
  neighbors: Neighbor[]
}

export interface LocalizedText {
  language_code: string
  translation_id: string
  raw_content: string
  metadata?: Record<string, unknown>
}

export interface NodesListResponse {
  label: string
  q: string
  count: number
  nodes: GraphNode[]
}

export interface EntitiesResponse {
  query: string
  count: number
  entities: string[]
}
