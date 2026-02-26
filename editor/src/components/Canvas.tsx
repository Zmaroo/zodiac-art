import { Fragment, useEffect, useRef } from 'react'
import type { PointerEvent, ReactElement, RefObject } from 'react'
import { useMaskedFrame } from '../hooks/useMaskedFrame'
import { buildChartTransform } from '../utils/geometry'
import type {
  ActiveSelectionLayer,
  ChartFit,
  ChartMeta,
  ChartOccluder,
  FrameCircle,
  FrameDetail,
  LayerOrderKey,
} from '../types'

export type CanvasProps = {
  meta: ChartMeta | null
  chartFit: ChartFit
  selectedFrameDetail: FrameDetail | null
  apiBase: string
  chartSvg: string
  chartId: string
  isChartOnly: boolean
  chartBackgroundColor: string
  chartOccluders: ChartOccluder[]
  selectedOccluderId: string
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
  chartFit,
  selectedFrameDetail,
  apiBase,
  chartSvg,
  chartId,
  isChartOnly,
  chartBackgroundColor,
  chartOccluders,
  selectedOccluderId,
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
  const maskId = `chart-occluder-mask-${chartId || 'draft'}-${selectedFrameDetail?.id ?? 'frame'}`
  const occluderMaskEnabled = chartOccluders.length > 0
  const occluderLayerActive = activeSelectionLayer === 'occluder'
  const occluderTransform = buildChartTransform(chartFit, meta) || undefined
  const showMaskGuide = Boolean(frameMaskGuideVisible || activeSelectionLayer === 'frame_mask')
  const showMaskHandles = activeSelectionLayer === 'frame_mask' && frameCircle && meta
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

  const backgroundLayer = showCircleBackground ? (
    <g
      ref={chartBackgroundRef}
      id="chartBackgroundRoot"
      mask={occluderMaskEnabled ? `url(#${maskId})` : undefined}
    >
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
    <g ref={chartRootRef} id="chartRoot" mask={occluderMaskEnabled ? `url(#${maskId})` : undefined}>
      <g dangerouslySetInnerHTML={{ __html: chartSvg }} />
    </g>
  )
  const occluderOverlay = chartOccluders.length ? (
    <g
      id="chartOccluderOverlay"
      transform={occluderTransform ?? undefined}
      pointerEvents={occluderLayerActive ? 'auto' : 'none'}
    >
      {chartOccluders.map((occluder) => {
        const isSelected = occluder.id === selectedOccluderId
        const stroke = isSelected ? 'rgba(255, 120, 0, 0.9)' : 'rgba(30, 30, 30, 0.6)'
        const fill = isSelected ? 'rgba(255, 170, 0, 0.15)' : 'rgba(30, 30, 30, 0.1)'
        const handleFill = 'rgba(255, 255, 255, 0.95)'
        const handleStroke = 'rgba(30, 30, 30, 0.8)'
        const handleSize = 6
        if (occluder.shape === 'ellipse') {
          const transform = occluder.rotation_deg
            ? `rotate(${occluder.rotation_deg} ${occluder.cx} ${occluder.cy})`
            : undefined
          return (
            <g key={occluder.id} data-occluder-id={occluder.id} transform={transform}>
              <ellipse
                data-occluder-id={occluder.id}
                cx={occluder.cx}
                cy={occluder.cy}
                rx={occluder.rx}
                ry={occluder.ry}
                fill={fill}
                stroke={stroke}
                strokeWidth={2}
              />
              {isSelected && occluderLayerActive ? (
                <g>
                  <circle
                    data-occluder-id={occluder.id}
                    data-occluder-handle="e"
                    cx={occluder.cx + occluder.rx}
                    cy={occluder.cy}
                    r={handleSize}
                    fill={handleFill}
                    stroke={handleStroke}
                    strokeWidth={1.5}
                  />
                  <circle
                    data-occluder-id={occluder.id}
                    data-occluder-handle="w"
                    cx={occluder.cx - occluder.rx}
                    cy={occluder.cy}
                    r={handleSize}
                    fill={handleFill}
                    stroke={handleStroke}
                    strokeWidth={1.5}
                  />
                  <circle
                    data-occluder-id={occluder.id}
                    data-occluder-handle="n"
                    cx={occluder.cx}
                    cy={occluder.cy - occluder.ry}
                    r={handleSize}
                    fill={handleFill}
                    stroke={handleStroke}
                    strokeWidth={1.5}
                  />
                  <circle
                    data-occluder-id={occluder.id}
                    data-occluder-handle="s"
                    cx={occluder.cx}
                    cy={occluder.cy + occluder.ry}
                    r={handleSize}
                    fill={handleFill}
                    stroke={handleStroke}
                    strokeWidth={1.5}
                  />
                </g>
              ) : null}
            </g>
          )
        }
        const centerX = occluder.x + occluder.width / 2
        const centerY = occluder.y + occluder.height / 2
        const transform = occluder.rotation_deg
          ? `rotate(${occluder.rotation_deg} ${centerX} ${centerY})`
          : undefined
        return (
          <g key={occluder.id} data-occluder-id={occluder.id} transform={transform}>
            <rect
              data-occluder-id={occluder.id}
              x={occluder.x}
              y={occluder.y}
              width={occluder.width}
              height={occluder.height}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
            />
            {isSelected && occluderLayerActive ? (
              <g>
                <rect
                  data-occluder-id={occluder.id}
                  data-occluder-handle="nw"
                  x={occluder.x - handleSize}
                  y={occluder.y - handleSize}
                  width={handleSize * 2}
                  height={handleSize * 2}
                  fill={handleFill}
                  stroke={handleStroke}
                  strokeWidth={1.5}
                />
                <rect
                  data-occluder-id={occluder.id}
                  data-occluder-handle="ne"
                  x={occluder.x + occluder.width - handleSize}
                  y={occluder.y - handleSize}
                  width={handleSize * 2}
                  height={handleSize * 2}
                  fill={handleFill}
                  stroke={handleStroke}
                  strokeWidth={1.5}
                />
                <rect
                  data-occluder-id={occluder.id}
                  data-occluder-handle="se"
                  x={occluder.x + occluder.width - handleSize}
                  y={occluder.y + occluder.height - handleSize}
                  width={handleSize * 2}
                  height={handleSize * 2}
                  fill={handleFill}
                  stroke={handleStroke}
                  strokeWidth={1.5}
                />
                <rect
                  data-occluder-id={occluder.id}
                  data-occluder-handle="sw"
                  x={occluder.x - handleSize}
                  y={occluder.y + occluder.height - handleSize}
                  width={handleSize * 2}
                  height={handleSize * 2}
                  fill={handleFill}
                  stroke={handleStroke}
                  strokeWidth={1.5}
                />
              </g>
            ) : null}
          </g>
        )
      })}
    </g>
  ) : null
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
          {occluderMaskEnabled ? (
            <defs>
              <mask id={maskId} maskUnits="userSpaceOnUse">
                <rect
                  x={0}
                  y={0}
                  width={meta.canvas.width}
                  height={meta.canvas.height}
                  fill="white"
                />
                <g transform={occluderTransform ?? undefined}>
                  {chartOccluders.map((occluder) => {
                    if (occluder.shape === 'ellipse') {
                      const transform = occluder.rotation_deg
                        ? `rotate(${occluder.rotation_deg} ${occluder.cx} ${occluder.cy})`
                        : undefined
                      return (
                        <ellipse
                          key={occluder.id}
                          cx={occluder.cx}
                          cy={occluder.cy}
                          rx={occluder.rx}
                          ry={occluder.ry}
                          transform={transform}
                          fill="black"
                        />
                      )
                    }
                    const centerX = occluder.x + occluder.width / 2
                    const centerY = occluder.y + occluder.height / 2
                    const transform = occluder.rotation_deg
                      ? `rotate(${occluder.rotation_deg} ${centerX} ${centerY})`
                      : undefined
                    return (
                      <rect
                        key={occluder.id}
                        x={occluder.x}
                        y={occluder.y}
                        width={occluder.width}
                        height={occluder.height}
                        transform={transform}
                        fill="black"
                      />
                    )
                  })}
                </g>
              </mask>
            </defs>
          ) : null}
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
          {occluderOverlay}
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
