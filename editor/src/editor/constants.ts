import type { ChartFit, DesignSettings } from '../types'

export const DEFAULT_CHART_FIT: ChartFit = { dx: 0, dy: 0, scale: 1, rotation_deg: 0 }
export const DEFAULT_DESIGN: DesignSettings = {
  layer_order: ['background', 'frame', 'chart_background_image', 'chart'],
  layer_opacity: {},
  background_image_path: null,
  background_image_scale: 1,
  background_image_dx: 0,
  background_image_dy: 0,
  sign_glyph_scale: 1,
  planet_glyph_scale: 1,
  inner_ring_scale: 1,
}
export const CHART_ONLY_ID = '__chart_only__'
export const CHART_BACKGROUND_ID = 'chart.background'
