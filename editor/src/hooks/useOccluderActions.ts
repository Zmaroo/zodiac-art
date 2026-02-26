import type { ChartMeta, ChartOccluder } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseOccluderActionsParams = {
  meta: ChartMeta | null
  chartOccluders: ChartOccluder[]
  selectedOccluderId: string
  dispatch: (action: EditorAction) => void
}

export function useOccluderActions(params: UseOccluderActionsParams) {
  const { meta, chartOccluders, selectedOccluderId, dispatch } = params

  const occluderDefaults = () => {
    const centerX = meta?.chart.center.x ?? 0
    const centerY = meta?.chart.center.y ?? 0
    const base = meta?.canvas.width ?? 1000
    const size = Math.max(24, base * 0.06)
    return { centerX, centerY, size }
  }

  const createOccluderId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID()
    }
    return `occ-${Date.now()}-${Math.random().toString(16).slice(2)}`
  }

  const handleAddOccluderEllipse = () => {
    const { centerX, centerY, size } = occluderDefaults()
    const nextOccluder: ChartOccluder = {
      id: createOccluderId(),
      shape: 'ellipse',
      cx: centerX,
      cy: centerY,
      rx: size,
      ry: size,
      rotation_deg: 0,
    }
    const next = [...chartOccluders, nextOccluder]
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
    dispatch({ type: 'SET_SELECTED_OCCLUDER', id: nextOccluder.id })
  }

  const handleAddOccluderRect = () => {
    const { centerX, centerY, size } = occluderDefaults()
    const nextOccluder: ChartOccluder = {
      id: createOccluderId(),
      shape: 'rect',
      x: centerX - size,
      y: centerY - size,
      width: size * 2,
      height: size * 2,
      rotation_deg: 0,
    }
    const next = [...chartOccluders, nextOccluder]
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
    dispatch({ type: 'SET_SELECTED_OCCLUDER', id: nextOccluder.id })
  }

  const handleSelectOccluder = (id: string) => {
    dispatch({ type: 'SET_SELECTED_OCCLUDER', id })
  }

  const handleUpdateOccluder = (id: string, nextOccluder: ChartOccluder) => {
    const next = chartOccluders.map((item) => (item.id === id ? nextOccluder : item))
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
  }

  const handleDeleteOccluder = (id: string) => {
    const next = chartOccluders.filter((item) => item.id !== id)
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
    if (selectedOccluderId === id) {
      dispatch({ type: 'SET_SELECTED_OCCLUDER', id: '' })
    }
  }

  const handleSnapOccluderToChart = () => {
    if (!meta || !selectedOccluderId) {
      return
    }
    const radius = meta.chart.ring_outer
    if (!Number.isFinite(radius) || radius <= 0) {
      return
    }
    const centerX = meta.chart.center.x
    const centerY = meta.chart.center.y
    const next = chartOccluders.map((item) => {
      if (item.id !== selectedOccluderId) {
        return item
      }
      if (item.shape === 'ellipse') {
        return {
          ...item,
          cx: centerX,
          cy: centerY,
          rx: radius,
          ry: radius,
        }
      }
      return {
        ...item,
        x: centerX - radius,
        y: centerY - radius,
        width: radius * 2,
        height: radius * 2,
      }
    })
    dispatch({ type: 'SET_OCCLUDERS', occluders: next })
  }

  return {
    handleAddOccluderEllipse,
    handleAddOccluderRect,
    handleSelectOccluder,
    handleUpdateOccluder,
    handleDeleteOccluder,
    handleSnapOccluderToChart,
  }
}
