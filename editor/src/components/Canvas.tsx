import { Fragment, useEffect, useRef } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { useMaskedFrame } from '../hooks/useMaskedFrame'
import type { ActiveSelectionLayer, ChartMeta, FrameCircle, FrameDetail, LayerOrderKey } from '../types'

type CanvasProps = {
  meta: ChartMeta | null
  selectedFrameDetail: FrameDetail | null
  apiBase: string
  chartSvg: string
  chartId: string
  isChartOnly: boolean
  chartBackgroundColor: string
  layerOrder: LayerOrderKey[]
  layerOpacity: Record<string, number>
  backgroundImageUrl: string
  backgroundImageScale: number
  backgroundImageDx: number
  backgroundImageDy: number
  activeSelectionLayer: ActiveSelectionLayer
  frameMaskCutoff: number
  showChartBackground: boolean
  frameCircle: FrameCircle | null
  showFrameCircleDebug: boolean
  svgRef: RefObject<SVGSVGElement | null>
  chartBackgroundRef: RefObject<SVGGElement | null>
  chartRootRef: RefObject<SVGGElement | null>
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
  onPointerUp: (event: PointerEvent<SVGSVGElement>) => void
}

function Canvas({
  meta,
  selectedFrameDetail,
  apiBase,
  chartSvg,
  chartId,
  isChartOnly,
  chartBackgroundColor,
  layerOrder,
  layerOpacity,
  backgroundImageUrl,
  backgroundImageScale,
  backgroundImageDx,
  backgroundImageDy,
  activeSelectionLayer,
  frameMaskCutoff,
  showChartBackground,
  frameCircle,
  showFrameCircleDebug,
  svgRef,
  chartBackgroundRef,
  chartRootRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: CanvasProps) {
  const canvasRef = useRef<HTMLElement | null>(null)
  const chartOnlyScrollKeyRef = useRef('')
  const debugCx = frameCircle ? frameCircle.cxNorm * (meta?.canvas.width ?? 0) : 0
  const debugCy = frameCircle ? frameCircle.cyNorm * (meta?.canvas.height ?? 0) : 0
  const debugR = frameCircle ? frameCircle.rNorm * (meta?.canvas.width ?? 0) : 0
  const frameUrl = selectedFrameDetail ? `${apiBase}${selectedFrameDetail.image_url}` : ''
  const showMaskedFrame = Boolean(selectedFrameDetail && meta && frameMaskCutoff < 255)
  const showCircleBackground = showChartBackground
  const maskCenter = frameCircle
    ? {
        x: frameCircle.cxNorm * (meta?.canvas.width ?? 0),
        y: frameCircle.cyNorm * (meta?.canvas.height ?? 0),
      }
    : (meta?.chart.center ?? { x: 0, y: 0 })
  const maskRadius = frameCircle
    ? frameCircle.rNorm * (meta?.canvas.width ?? 0)
    : (meta?.chart.ring_outer ?? 0)
  const maskedFrameUrl = useMaskedFrame(
    frameUrl,
    showMaskedFrame,
    maskCenter,
    maskRadius,
    frameMaskCutoff
  )
  const frameHref = showMaskedFrame ? maskedFrameUrl || frameUrl : frameUrl

  useEffect(() => {
    if (!isChartOnly || !meta || !chartId) {
      return
    }
    const key = `${chartId}:${meta.canvas.width}:${meta.canvas.height}`
    if (chartOnlyScrollKeyRef.current === key) {
      return
    }
    chartOnlyScrollKeyRef.current = key
    requestAnimationFrame(() => {
      const container = canvasRef.current
      if (!container) {
        return
      }
      const targetLeft = Math.max(0, (container.scrollWidth - container.clientWidth) / 2)
      const targetTop = Math.max(0, (container.scrollHeight - container.clientHeight) / 2)
      container.scrollLeft = targetLeft
      container.scrollTop = targetTop
    })
  }, [chartId, isChartOnly, meta])

  const backgroundLayer = showCircleBackground ? (
    <g ref={chartBackgroundRef} id="chartBackgroundRoot">
      <circle
        id="chart.background"
        data-fill-only="true"
        cx={meta?.chart.center.x ?? 0}
        cy={meta?.chart.center.y ?? 0}
        r={meta?.chart.ring_outer ?? 0}
        fill={chartBackgroundColor || 'none'}
        stroke="none"
      />
    </g>
  ) : null
  const frameLayer = selectedFrameDetail ? (
    <image
      href={frameHref}
      x={0}
      y={0}
      width={meta?.canvas.width ?? 0}
      height={meta?.canvas.height ?? 0}
      pointerEvents="none"
    />
  ) : null
  const chartLayer = (
    <g ref={chartRootRef} id="chartRoot">
      <g dangerouslySetInnerHTML={{ __html: chartSvg }} />
    </g>
  )
  const backgroundImageLayer = backgroundImageUrl ? (
    <g
      id="chartBackgroundImageRoot"
      pointerEvents={
        activeSelectionLayer === 'chart' || activeSelectionLayer === 'background' ? 'none' : 'auto'
      }
    >
      <image
        id="chart.background_image"
        href={backgroundImageUrl}
        x={backgroundImageDx}
        y={backgroundImageDy}
        width={(meta?.canvas.width ?? 0) * backgroundImageScale}
        height={(meta?.canvas.height ?? 0) * backgroundImageScale}
      />
    </g>
  ) : null
  const layers: Record<LayerOrderKey, JSX.Element | null> = {
    background: backgroundLayer,
    frame: frameLayer,
    chart_background_image: backgroundImageLayer,
    chart: chartLayer,
  }
  return (
    <main className="canvas" ref={canvasRef}>
      {meta ? (
        <svg
          ref={svgRef}
          width={meta.canvas.width}
          height={meta.canvas.height}
          viewBox={`0 0 ${meta.canvas.width} ${meta.canvas.height}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {layerOrder.map((key) => {
            const layer = layers[key]
            if (!layer) {
              return null
            }
            const opacity = layerOpacity[key]
            if (opacity !== undefined && opacity >= 0 && opacity <= 1 && opacity !== 1) {
              return (
                <g key={key} opacity={opacity}>
                  {layer}
                </g>
              )
            }
            return <Fragment key={key}>{layer}</Fragment>
          })}
          {showFrameCircleDebug && frameCircle ? (
            <circle
              cx={debugCx}
              cy={debugCy}
              r={debugR}
              fill="none"
              stroke="rgba(0, 120, 255, 0.7)"
              strokeWidth={2}
              pointerEvents="none"
            />
          ) : null}
          {!chartId ? (
            <text
              x={meta.chart.center.x}
              y={meta.chart.center.y}
              textAnchor="middle"
              fill="rgba(20, 20, 20, 0.6)"
              fontSize={18}
            >
              Set chart ID to load overlay
            </text>
          ) : null}
        </svg>
      ) : (
        <div className="placeholder">
          {isChartOnly ? 'Select a chart to begin.' : 'Select a frame to begin.'}
        </div>
      )}
    </main>
  )
}

export default Canvas
