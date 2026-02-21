import type { ChartMeta, FrameCircle } from '../types'

type UseEditorDerivedParams = {
  meta: ChartMeta | null
}

export function useEditorDerived({ meta }: UseEditorDerivedParams) {
  const computeFitFromCircle = (metaData: ChartMeta, circle: FrameCircle) => {
    const cx = circle.cxNorm * metaData.canvas.width
    const cy = circle.cyNorm * metaData.canvas.height
    const r = circle.rNorm * metaData.canvas.width
    const scale = r / metaData.chart.ring_outer
    return {
      dx: cx - metaData.chart.center.x,
      dy: cy - metaData.chart.center.y,
      scale,
      rotation_deg: metaData.chart_fit?.rotation_deg ?? 0,
    }
  }

  const resetToSavedEnabled = Boolean(meta?.chart_fit)

  return { computeFitFromCircle, resetToSavedEnabled }
}
