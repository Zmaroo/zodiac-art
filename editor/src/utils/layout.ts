import { normalizeOverride, round } from './format'
import type { ChartFit, ChartOccluder, DesignSettings, FrameCircle, Offset } from '../types'

type LayoutPayloadInput = {
  overrides: Record<string, Offset>
  design?: DesignSettings
  frameCircle?: FrameCircle | null
  chartFit?: ChartFit
  chartOccluders?: ChartOccluder[]
  frameMaskCutoff?: number
  frameMaskOffwhiteBoost?: number
}

export function buildChartFitPayload(chartFit: ChartFit) {
  return {
    dx: round(chartFit.dx),
    dy: round(chartFit.dy),
    scale: round(chartFit.scale),
    rotation_deg: round(chartFit.rotation_deg),
  }
}

export function buildLayoutPayload(input: LayoutPayloadInput) {
  const payload: Record<string, unknown> = {
    overrides: Object.fromEntries(
      Object.entries(input.overrides).map(([entryKey, value]) => [
        entryKey,
        normalizeOverride(value),
      ])
    ),
  }
  if (input.design) {
    payload.design = input.design
  }
  if (input.frameCircle !== undefined) {
    payload.frame_circle = input.frameCircle
  }
  if (input.chartFit) {
    payload.chart_fit = buildChartFitPayload(input.chartFit)
  }
  if (input.chartOccluders) {
    payload.chart_occluders = input.chartOccluders
  }
  if (typeof input.frameMaskCutoff === 'number') {
    payload.frame_mask_cutoff = input.frameMaskCutoff
  }
  if (typeof input.frameMaskOffwhiteBoost === 'number') {
    payload.frame_mask_offwhite_boost = input.frameMaskOffwhiteBoost
  }
  return payload
}
