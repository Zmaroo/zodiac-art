import { useState } from 'react'
import type { PointerEvent } from 'react'
import type { ChartFit, DragState, Offset } from '../types'
import type { EditorAction } from '../state/editorReducer'
import { isDraggableElement } from '../utils/format'
import { toNodePoint, toSvgPoint } from '../utils/geometry'

type UseChartInteractionParams = {
  chartFit: ChartFit
  overrides: Record<string, Offset>
  svgRef: React.RefObject<SVGSVGElement | null>
  chartRootRef: React.RefObject<SVGGElement | null>
  dispatch: (action: EditorAction) => void
}

type UseChartInteractionResult = {
  onPointerDown: (event: PointerEvent<SVGSVGElement>) => void
  onPointerMove: (event: PointerEvent<SVGSVGElement>) => void
  onPointerUp: (event: PointerEvent<SVGSVGElement>) => void
}

export function useChartInteraction(params: UseChartInteractionParams): UseChartInteractionResult {
  const { chartFit, overrides, svgRef, chartRootRef, dispatch } = params
  const [drag, setDrag] = useState<DragState | null>(null)

  const onPointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !chartRootRef.current) {
      return
    }
    const target = event.target as Element | null
    const labelElement = target?.closest('[id]') as Element | null
    const chartElement = target?.closest('#chartRoot') as Element | null

    const point = labelElement && chartRootRef.current
      ? toNodePoint(event, chartRootRef.current)
      : toSvgPoint(event, svgRef.current)
    if (labelElement) {
      const id = labelElement.getAttribute('id') || ''
      if (isDraggableElement(id)) {
        const current = overrides[id] || { dx: 0, dy: 0 }
        dispatch({ type: 'SET_SELECTED_ELEMENT', id })
        setDrag({
          mode: 'label',
          startPoint: point,
          startFit: chartFit,
          labelId: id,
          startOffset: current,
        })
        svgRef.current.setPointerCapture(event.pointerId)
        return
      }
    }

    if (chartElement) {
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
    if (drag.mode === 'label' && drag.labelId && drag.startOffset) {
      dispatch({
        type: 'SET_OVERRIDES',
        overrides: {
          ...overrides,
          [drag.labelId as string]: {
            dx: (drag.startOffset?.dx ?? 0) + dx,
            dy: (drag.startOffset?.dy ?? 0) + dy,
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
