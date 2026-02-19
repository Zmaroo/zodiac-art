import { useEffect } from 'react'
import type { ChartFit, ChartMeta } from '../types'

type UseChartTransformParams = {
  chartFit: ChartFit
  meta: ChartMeta | null
  chartSvg: string
  chartRootRef: React.RefObject<SVGGElement | null>
}

export function useChartTransform(params: UseChartTransformParams) {
  const { chartFit, meta, chartSvg, chartRootRef } = params

  useEffect(() => {
    if (!chartRootRef.current || !meta) {
      return
    }
    const { x, y } = meta.chart.center
    const transform = [
      `translate(${chartFit.dx.toFixed(3)} ${chartFit.dy.toFixed(3)})`,
      `translate(${x.toFixed(3)} ${y.toFixed(3)})`,
      `rotate(${chartFit.rotation_deg.toFixed(3)})`,
      `scale(${chartFit.scale.toFixed(6)})`,
      `translate(${-x.toFixed(3)} ${-y.toFixed(3)})`,
    ].join(' ')
    chartRootRef.current.setAttribute('transform', transform)
  }, [chartFit, chartRootRef, chartSvg, meta])
}
