import { useState } from 'react'
import type { PointerEvent } from 'react'
import type { ChartFit, DesignSettings, DragState, Offset } from '../types'
import type { EditorAction } from '../state/editorReducer'
import { isDraggableElement } from '../utils/format'
import { toNodePoint, toSvgPoint } from '../utils/geometry'

type UseChartInteractionParams = {
  chartFit: ChartFit
  overrides: Record<string, Offset>
  design: DesignSettings
  selectedElement: string
  updateDesign: (next: Partial<DesignSettings>) => void
  svgRef: React.RefObject<SVGSVGElement | null>
  chartRootRef: React.RefObject<SVGGElement | null>
  dispatch: (action: EditorAction) => void
  radialMoveEnabled: boolean
}

type UseChartInteractionResult = {
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
  onPointerUp: (event: PointerEvent<SVGSVGElement>) => void
}

export function useChartInteraction(params: UseChartInteractionParams): UseChartInteractionResult {
  const {
    chartFit,
    overrides,
    design,
    selectedElement,
    updateDesign,
    svgRef,
    chartRootRef,
    dispatch,
    radialMoveEnabled,
  } = params
  const [drag, setDrag] = useState<DragState | null>(null)
  const backgroundImageId = 'chart.background_image'

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !chartRootRef.current) {
      return
    }
    const target = event.target as Element | null
    const labelElement = target?.closest('[id]') as Element | null
    const chartElement = target?.closest('#chartRoot') as Element | null
    const chartBackgroundElement = target?.closest('#chartBackgroundRoot') as Element | null
    const backgroundImageElement = target?.closest('#chartBackgroundImageRoot') as Element | null

    const point = labelElement && chartRootRef.current
      ? toNodePoint(event, chartRootRef.current)
      : toSvgPoint(event, svgRef.current)
    if (labelElement) {
      const id = labelElement.getAttribute('id') || ''
      if (isDraggableElement(id)) {
        const theta = Number(labelElement.getAttribute('data-theta'))
        const current = overrides[id] || { dx: 0, dy: 0 }
        dispatch({ type: 'SET_SELECTED_ELEMENT', id })
        setDrag({
          mode: 'label',
          startPoint: point,
          startFit: chartFit,
          labelId: id,
          startOffset: current,
          labelTheta: Number.isFinite(theta) ? theta : undefined,
        })
        svgRef.current.setPointerCapture(event.pointerId)
        return
      }
    }

    if (
      design.background_image_path &&
      (backgroundImageElement || selectedElement === backgroundImageId)
    ) {
      const mode = event.shiftKey ? 'background-image-scale' : 'background-image-move'
      dispatch({ type: 'SET_SELECTED_ELEMENT', id: backgroundImageId })
      setDrag({
        mode,
        startPoint: point,
        startFit: chartFit,
        backgroundImage: {
          scale: design.background_image_scale,
          dx: design.background_image_dx,
          dy: design.background_image_dy,
        },
      })
      svgRef.current.setPointerCapture(event.pointerId)
      return
    }

    if (chartElement || chartBackgroundElement) {
      const mode = event.shiftKey
        ? 'chart-scale'
        : event.altKey
          ? 'chart-rotate'
          : 'chart-move'
      dispatch({ type: 'SET_SELECTED_ELEMENT', id: 'chartRoot' })
      setDrag({ mode, startPoint: point, startFit: chartFit })
      svgRef.current.setPointerCapture(event.pointerId)
    }
  }

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag || !svgRef.current) {
      return
    }
    const point =
      drag.mode === 'label' && chartRootRef.current
        ? toNodePoint(event, chartRootRef.current)
        : toSvgPoint(event, svgRef.current)
    const dx = point.x - drag.startPoint.x
    const dy = point.y - drag.startPoint.y

    if (drag.mode === 'chart-move') {
      dispatch({
        type: 'SET_CHART_FIT',
        fit: {
          ...drag.startFit,
          dx: drag.startFit.dx + dx,
          dy: drag.startFit.dy + dy,
        },
        userAdjusted: true,
      })
      return
    }
    if (drag.mode === 'chart-scale') {
      const nextScale = Math.max(0.1, drag.startFit.scale * (1 + dx / 300))
      dispatch({
        type: 'SET_CHART_FIT',
        fit: { ...drag.startFit, scale: nextScale },
        userAdjusted: true,
      })
      return
    }
    if (drag.mode === 'chart-rotate') {
      dispatch({
        type: 'SET_CHART_FIT',
        fit: {
          ...drag.startFit,
          rotation_deg: drag.startFit.rotation_deg + dx,
        },
        userAdjusted: true,
      })
      return
    }
    if (drag.mode === 'background-image-move' && drag.backgroundImage) {
      updateDesign({
        background_image_dx: drag.backgroundImage.dx + dx,
        background_image_dy: drag.backgroundImage.dy + dy,
      })
      return
    }
    if (drag.mode === 'background-image-scale' && drag.backgroundImage) {
      const nextScale = Math.max(0.1, drag.backgroundImage.scale * (1 + dx / 300))
      updateDesign({ background_image_scale: nextScale })
      return
    }
    if (drag.mode === 'label' && drag.labelId && drag.startOffset) {
      const baseOffset = drag.startOffset
      const color = baseOffset.color
      if (radialMoveEnabled && Number.isFinite(drag.labelTheta)) {
        const theta = drag.labelTheta ?? 0
        const angle = (Math.PI / 180) * theta
        const drBase =
          baseOffset.dr ?? (baseOffset.dx ?? 0) * Math.cos(angle) + (baseOffset.dy ?? 0) * Math.sin(angle)
        const dtBase =
          baseOffset.dt ?? -(baseOffset.dx ?? 0) * Math.sin(angle) + (baseOffset.dy ?? 0) * Math.cos(angle)
        const drDelta = dx * Math.cos(angle) + dy * Math.sin(angle)
        dispatch({
          type: 'SET_OVERRIDES',
          overrides: {
            ...overrides,
            [drag.labelId as string]: {
              dr: drBase + drDelta,
              dt: dtBase,
              color,
            },
          },
        })
        return
      }
      dispatch({
        type: 'SET_OVERRIDES',
        overrides: {
          ...overrides,
          [drag.labelId as string]: {
            dx: (baseOffset.dx ?? 0) + dx,
            dy: (baseOffset.dy ?? 0) + dy,
            color,
          },
        },
      })
    }
  }

  const onPointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) {
      return
    }
    if (svgRef.current.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId)
    }
    setDrag(null)
  }

  return { onPointerDown, onPointerMove, onPointerUp }
}
