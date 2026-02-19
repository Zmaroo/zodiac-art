import { useMemo } from 'react'
import type { Offset } from '../types'

type UseChartBackgroundParams = {
  chartSvgBase: string
  overrides: Record<string, Offset>
  chartBackgroundId: string
}

export function useChartBackground(params: UseChartBackgroundParams) {
  const { chartSvgBase, overrides, chartBackgroundId } = params
  const chartBackgroundColor = overrides[chartBackgroundId]?.color || ''
  const hasChartBackground = useMemo(() => {
    if (!chartSvgBase) {
      return false
    }
    return /id=("|')chart\.background\1/.test(chartSvgBase)
  }, [chartSvgBase])

  return { chartBackgroundColor, hasChartBackground }
}
