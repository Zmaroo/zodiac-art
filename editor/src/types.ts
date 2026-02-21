export type FrameEntry = {
  id: string
  name: string
  tags: string[]
  width: number
  height: number
  thumb_url: string
}

export type FrameDetail = FrameEntry & {
  image_url: string
  template_metadata_json: ChartMeta
}

export type ChartListItem = {
  chart_id: string
  name?: string
  created_at?: string
  default_frame_id?: string | null
}

export type ChartDetail = {
  chart_id: string
  name?: string
  birth_date: string
  birth_time: string
  latitude: number
  longitude: number
  default_frame_id?: string | null
}

export type ChartMeta = {
  canvas: { width: number; height: number }
  chart: {
    center: { x: number; y: number }
    ring_outer: number
    ring_inner: number
    rotation_deg?: number
  }
  chart_fit?: {
    dx?: number
    dy?: number
    scale?: number
    rotation_deg?: number
  }
}

export type ChartFit = {
  dx: number
  dy: number
  scale: number
  rotation_deg: number
}

export type FrameCircle = {
  cxNorm: number
  cyNorm: number
  rNorm: number
}

export type Offset = { dx?: number; dy?: number; dr?: number; dt?: number; color?: string }

export type LayoutFile = {
  overrides?: Record<string, Offset>
  frame_circle?: FrameCircle
}

export type DragState = {
  mode: 'chart-move' | 'chart-scale' | 'chart-rotate' | 'label'
  startPoint: { x: number; y: number }
  startFit: ChartFit
  labelId?: string
  startOffset?: Offset
  labelTheta?: number
}

export type User = { id: string; email: string; is_admin?: boolean }
