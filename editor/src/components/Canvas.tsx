import type { PointerEvent, RefObject } from 'react'
import { useMaskedFrame } from '../hooks/useMaskedFrame'
import type { ChartMeta, FrameCircle, FrameDetail } from '../types'

type CanvasProps = {
  meta: ChartMeta | null
  selectedFrameDetail: FrameDetail | null
  apiBase: string
  chartSvg: string
  chartId: string
  isChartOnly: boolean
  chartBackgroundColor: string
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
  const debugCx = frameCircle ? frameCircle.cxNorm * (meta?.canvas.width ?? 0) : 0
  const debugCy = frameCircle ? frameCircle.cyNorm * (meta?.canvas.height ?? 0) : 0
  const debugR = frameCircle ? frameCircle.rNorm * (meta?.canvas.width ?? 0) : 0
  const frameUrl = selectedFrameDetail ? `${apiBase}${selectedFrameDetail.image_url}` : ''
  const showMaskedFrame = Boolean(selectedFrameDetail && showChartBackground)
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
  return (
    <main className="canvas">
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
          {showCircleBackground ? (
            <g ref={chartBackgroundRef} id="chartBackgroundRoot">
              <circle
                id="chart.background"
                data-fill-only="true"
                cx={meta.chart.center.x}
                cy={meta.chart.center.y}
                r={meta.chart.ring_outer}
                fill={chartBackgroundColor || 'none'}
                stroke="none"
              />
            </g>
          ) : null}
          {selectedFrameDetail ? (
            <image
              href={frameHref}
              x={0}
              y={0}
              width={meta.canvas.width}
              height={meta.canvas.height}
            />
          ) : null}
          <g ref={chartRootRef} id="chartRoot">
            <g dangerouslySetInnerHTML={{ __html: chartSvg }} />
          </g>
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
