import { useEffect } from 'react'
import type { ChartFit, ChartMeta, FrameCircle } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseAutoFitParams = {
  isChartOnly: boolean
  meta: ChartMeta | null
  frameCircle: FrameCircle | null
  userAdjustedFit: boolean
  dispatch: (action: EditorAction) => void
}

export function useAutoFit(params: UseAutoFitParams) {
  const { isChartOnly, meta, frameCircle, userAdjustedFit, dispatch } = params

  useEffect(() => {
    if (isChartOnly || !meta || !frameCircle) {
      return
    }
    if (userAdjustedFit) {
      return
    }
    const cx = frameCircle.cxNorm * meta.canvas.width
    const cy = frameCircle.cyNorm * meta.canvas.height
    const r = frameCircle.rNorm * meta.canvas.width
    const scale = r / meta.chart.ring_outer
    const fit: ChartFit = {
      dx: cx - meta.chart.center.x,
      dy: cy - meta.chart.center.y,
      scale,
      rotation_deg: meta.chart_fit?.rotation_deg ?? 0,
    }
    dispatch({ type: 'AUTO_FIT_APPLIED', fit })
  }, [dispatch, frameCircle, isChartOnly, meta, userAdjustedFit])
}
