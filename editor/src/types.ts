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

export type LayerOrderKey = 'background' | 'frame' | 'chart' | 'chart_background_image'

export type ActiveSelectionLayer = 'auto' | 'chart' | 'background' | 'background_image'

export type DesignSettings = {
  layer_order: LayerOrderKey[]
  layer_opacity: Record<string, number>
  background_image_path?: string | null
  background_image_scale: number
  background_image_dx: number
  background_image_dy: number
  sign_glyph_scale: number
  planet_glyph_scale: number
  inner_ring_scale: number
}

export type Offset = { dx?: number; dy?: number; dr?: number; dt?: number; color?: string }

export type EditorDraft = {
  key: string
  chart_id: string
  frame_id: string | null
  is_chart_only: boolean
  chart_fit: ChartFit
  overrides: Record<string, Offset>
  design: DesignSettings
  frame_circle: FrameCircle | null
  client_version: number
  server_version: number
  last_saved_at: number | null
  last_synced_at: number | null
}

export type EditorDoc = {
  chart_id: string
  frame_id: string | null
  is_chart_only: boolean
  chart_fit: ChartFit
  overrides: Record<string, Offset>
  design: DesignSettings
  frame_circle: FrameCircle | null
  client_version: number
  server_version: number
  last_saved_at: number | null
  last_synced_at: number | null
}

export type LayoutFile = {
  overrides?: Record<string, Offset>
  frame_circle?: FrameCircle
  design?: Partial<DesignSettings>
  chart_fit?: Partial<ChartFit>
}

export type DragState = {
  mode:
    | 'chart-move'
    | 'chart-scale'
    | 'chart-rotate'
    | 'label'
    | 'background-image-move'
    | 'background-image-scale'
  startPoint: { x: number; y: number }
  startFit: ChartFit
  labelId?: string
  startOffset?: Offset
  labelTheta?: number
  backgroundImage?: { scale: number; dx: number; dy: number }
}

export type User = { id: string; email: string; is_admin?: boolean }
