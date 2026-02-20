import type { Offset } from '../types'

type UseChartBackgroundParams = {
  chartSvgBase: string
  overrides: Record<string, Offset>
  chartBackgroundId: string
}

export function useChartBackground(params: UseChartBackgroundParams) {
  const { overrides, chartBackgroundId } = params
  const chartBackgroundColor = overrides[chartBackgroundId]?.color || ''

  return { chartBackgroundColor }
}
