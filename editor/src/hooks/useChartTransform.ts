import { useEffect } from 'react'
import type { ChartFit, ChartMeta } from '../types'
import { buildChartTransform } from '../utils/geometry'

type UseChartTransformParams = {
  chartFit: ChartFit
  meta: ChartMeta | null
  chartSvg: string
  chartRootRef: React.RefObject<SVGGElement | null>
  chartBackgroundRef?: React.RefObject<SVGGElement | null>
}

export function useChartTransform(params: UseChartTransformParams) {
  const { chartFit, meta, chartSvg, chartRootRef, chartBackgroundRef } = params

  useEffect(() => {
    if (!chartRootRef.current || !meta) {
      return
    }
    const transform = buildChartTransform(chartFit, meta)
    chartRootRef.current.setAttribute('transform', transform)
    if (chartBackgroundRef?.current) {
      chartBackgroundRef.current.setAttribute('transform', transform)
    }
  }, [chartFit, chartRootRef, chartBackgroundRef, chartSvg, meta])
}
