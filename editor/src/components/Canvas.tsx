import { Fragment, useEffect, useRef } from 'react'
import type { PointerEvent, ReactElement, RefObject } from 'react'
import { useMaskedFrame } from '../hooks/useMaskedFrame'
import type {
  ActiveSelectionLayer,
  ChartMeta,
  FrameCircle,
  FrameDetail,
  LayerOrderKey,
} from '../types'

export type CanvasProps = {
  meta: ChartMeta | null
  selectedFrameDetail: FrameDetail | null
  apiBase: string
  chartSvg: string
  chartId: string
  isChartOnly: boolean
  chartBackgroundColor: string
  chartBackgroundOffset?: { dx?: number; dy?: number; dr?: number }
  layerOrder: LayerOrderKey[]
  layerOpacity: Record<string, number>
  backgroundImageUrl: string
  backgroundImageScale: number
  backgroundImageDx: number
  backgroundImageDy: number
  activeSelectionLayer: ActiveSelectionLayer
  frameMaskCutoff: number
  frameMaskOffwhiteBoost: number
  frameMaskGuideVisible: boolean
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
  chartBackgroundOffset,
  layerOrder,
  layerOpacity,
  backgroundImageUrl,
  backgroundImageScale,
  backgroundImageDx,
  backgroundImageDy,
  activeSelectionLayer,
  frameMaskCutoff,
  frameMaskOffwhiteBoost,
  frameMaskGuideVisible,
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
  const frameOnlyScrollKeyRef = useRef('')
  const framedScrollKeyRef = useRef('')
  const debugCx = frameCircle ? frameCircle.cxNorm * (meta?.canvas.width ?? 0) : 0
  const debugCy = frameCircle ? frameCircle.cyNorm * (meta?.canvas.height ?? 0) : 0
  const debugRx = frameCircle ? (frameCircle.rxNorm ?? frameCircle.rNorm) * (meta?.canvas.width ?? 0) : 0
  const debugRy = frameCircle ? (frameCircle.ryNorm ?? frameCircle.rNorm) * (meta?.canvas.height ?? 0) : 0
  const frameUrl = selectedFrameDetail ? `${apiBase}${selectedFrameDetail.image_url}` : ''
  const showMaskedFrame = Boolean(selectedFrameDetail && meta && frameMaskCutoff < 255)
  const showCircleBackground = showChartBackground
  const maskCenter = frameCircle
    ? {
        x: frameCircle.cxNorm * (meta?.canvas.width ?? 0),
        y: frameCircle.cyNorm * (meta?.canvas.height ?? 0),
      }
    : (meta?.chart.center ?? { x: 0, y: 0 })
  const maskRadiusX = frameCircle
    ? (frameCircle.rxNorm ?? frameCircle.rNorm) * (meta?.canvas.width ?? 0)
    : (meta?.chart.ring_outer ?? 0)
  const maskRadiusY = frameCircle
    ? (frameCircle.ryNorm ?? frameCircle.rNorm) * (meta?.canvas.height ?? 0)
    : (meta?.chart.ring_outer ?? 0)
  const maskedFrameUrl = useMaskedFrame(
    frameUrl,
    showMaskedFrame,
    maskCenter,
    maskRadiusX,
    maskRadiusY,
    frameMaskCutoff,
    frameMaskOffwhiteBoost
  )
  const frameHref = showMaskedFrame ? maskedFrameUrl || frameUrl : frameUrl
  const showMaskGuide = Boolean(frameMaskGuideVisible && activeSelectionLayer === 'frame_mask')
  const showMaskHandles =
    Boolean(frameMaskGuideVisible && activeSelectionLayer === 'frame_mask' && frameCircle && meta)
  const maskHandleRadius = 6
  const maskHandlePoints = showMaskHandles
    ? [
        { id: 'n', x: debugCx, y: debugCy - debugRy },
        { id: 's', x: debugCx, y: debugCy + debugRy },
        { id: 'e', x: debugCx + debugRx, y: debugCy },
        { id: 'w', x: debugCx - debugRx, y: debugCy },
        { id: 'ne', x: debugCx + debugRx * 0.707, y: debugCy - debugRy * 0.707 },
        { id: 'nw', x: debugCx - debugRx * 0.707, y: debugCy - debugRy * 0.707 },
        { id: 'se', x: debugCx + debugRx * 0.707, y: debugCy + debugRy * 0.707 },
        { id: 'sw', x: debugCx - debugRx * 0.707, y: debugCy + debugRy * 0.707 },
      ]
    : []

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

  useEffect(() => {
    if (chartId || !meta || !selectedFrameDetail) {
      return
    }
    const key = `${selectedFrameDetail.id}:${meta.canvas.width}:${meta.canvas.height}`
    if (frameOnlyScrollKeyRef.current === key) {
      return
    }
    frameOnlyScrollKeyRef.current = key
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
  }, [chartId, meta, selectedFrameDetail])

  useEffect(() => {
    if (!chartId || !meta || !selectedFrameDetail) {
      return
    }
    const key = `${chartId}:${selectedFrameDetail.id}:${meta.canvas.width}:${meta.canvas.height}`
    if (framedScrollKeyRef.current === key) {
      return
    }
    framedScrollKeyRef.current = key
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
  }, [chartId, meta, selectedFrameDetail])

  const backgroundDx = chartBackgroundOffset?.dx ?? 0
  const backgroundDy = chartBackgroundOffset?.dy ?? 0
  const backgroundDr = chartBackgroundOffset?.dr ?? 0
  const backgroundLayer = showCircleBackground ? (
    <g
      ref={chartBackgroundRef}
      id="chartBackgroundRoot"
    >
      <circle
        id="chart.background"
        data-fill-only="true"
        cx={(meta?.chart.center.x ?? 0) + backgroundDx}
        cy={(meta?.chart.center.y ?? 0) + backgroundDy}
        r={Math.max(0, (meta?.chart.ring_outer ?? 0) + backgroundDr)}
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
      pointerEvents={activeSelectionLayer === 'chart' ? 'none' : 'auto'}
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
  const layers: Record<LayerOrderKey, ReactElement | null> = {
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
          {showMaskGuide && frameCircle ? (
            <g>
              <ellipse
                cx={debugCx}
                cy={debugCy}
                rx={debugRx}
                ry={debugRy}
                fill="none"
                stroke="rgba(0, 120, 255, 0.7)"
                strokeDasharray={activeSelectionLayer === 'frame_mask' ? undefined : '6 6'}
                strokeWidth={2}
                pointerEvents="none"
              />
              {activeSelectionLayer === 'frame_mask' ? (
                <ellipse
                  cx={debugCx}
                  cy={debugCy}
                  rx={debugRx}
                  ry={debugRy}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  data-frame-mask-body
                />
              ) : null}
              {maskHandlePoints.map((handle) => (
                <circle
                  key={handle.id}
                  cx={handle.x}
                  cy={handle.y}
                  r={maskHandleRadius}
                  fill="white"
                  stroke="rgba(0, 120, 255, 0.9)"
                  strokeWidth={2}
                  data-frame-mask-handle={handle.id}
                />
              ))}
            </g>
          ) : null}
          {showFrameCircleDebug && frameCircle ? (
            <ellipse
              cx={debugCx}
              cy={debugCy}
              rx={debugRx}
              ry={debugRy}
              fill="none"
              stroke="rgba(0, 120, 255, 0.4)"
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
