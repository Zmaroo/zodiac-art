import { useMemo } from 'react'
import { formatSelectionLabel } from '../utils/glyphs'
import { isDraggableElement } from '../utils/format'
import type { ActiveSelectionLayer, Offset, ChartMeta } from '../types'
import type { EditorAction } from '../state/editorReducer'

const CHART_BACKGROUND_ID = 'chart.background'
const BACKGROUND_IMAGE_ID = 'chart.background_image'
const BULK_ALL = '__bulk_all__'
const BULK_PLANETS = '__bulk_planets__'
const BULK_SIGNS = '__bulk_signs__'
const BULK_GLYPHS = '__bulk_glyphs__'

type UseSelectionParams = {
  chartSvg: string
  meta: ChartMeta | null
  overrides: Record<string, Offset>
  selectedElement: string
  hasBackgroundImage: boolean
  dispatch: (action: EditorAction) => void
}

type UseSelectionResult = {
  selectableGroups: { label: string; items: { id: string; label: string }[] }[]
  selectableIds: string[]
  selectionTargets: string[]
  selectionColor: string
  selectionColorMixed: boolean
  selectionEnabled: boolean
  setSelectedElement: (value: string) => void
  applySelectionColor: (color: string | null) => void
  bulkIds: {
    all: string
    planets: string
    signs: string
    glyphs: string
  }
  chartBackgroundId: string
}

export function useSelection(params: UseSelectionParams): UseSelectionResult {
  const { chartSvg, meta, overrides, selectedElement, hasBackgroundImage, dispatch } = params

  const selectableGroups = useMemo(() => {
    if (!chartSvg) {
      return [] as { label: string; items: { id: string; label: string }[] }[]
    }
    const parser = new DOMParser()
    const doc = parser.parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">${chartSvg}</svg>`,
      'image/svg+xml'
    )
    const ids = Array.from(doc.querySelectorAll('[id]'))
      .map((node) => node.getAttribute('id') || '')
      .filter((id) => id && (id === 'chartRoot' || isDraggableElement(id)))
    const idSet = new Set(ids)
    if (meta) {
      idSet.add('chartRoot')
    }
    const uniqueIds = Array.from(idSet).sort()
    const groups = {
      Chart: [] as { id: string; label: string }[],
      Planets: [] as { id: string; label: string }[],
      Signs: [] as { id: string; label: string }[],
      Ascendant: [] as { id: string; label: string }[],
      Other: [] as { id: string; label: string }[],
    }
    uniqueIds.forEach((id) => {
      const item = { id, label: formatSelectionLabel(id) }
      if (id === 'chartRoot') {
        groups.Chart.push(item)
      } else if (id === 'asc.marker') {
        groups.Ascendant.push(item)
      } else if (id.startsWith('planet.')) {
        groups.Planets.push(item)
      } else if (id.startsWith('sign.')) {
        groups.Signs.push(item)
      } else {
        groups.Other.push(item)
      }
    })
    const chartOrder = new Map([['chartRoot', 0]])
    groups.Chart.sort((a, b) => {
      const aRank = chartOrder.get(a.id) ?? 999
      const bRank = chartOrder.get(b.id) ?? 999
      return aRank - bRank
    })
    const grouped = Object.entries(groups)
      .filter(([, items]) => items.length > 0)
      .map(([label, items]) => ({ label, items }))
    const bulkItems = [
      { id: BULK_ALL, label: 'Select all' },
      { id: BULK_PLANETS, label: 'All planets' },
      { id: BULK_SIGNS, label: 'All signs' },
      { id: BULK_GLYPHS, label: 'All glyphs' },
    ]
    return [{ label: 'Bulk', items: bulkItems }, ...grouped]
  }, [chartSvg, hasBackgroundImage, meta])

  const selectableElements = useMemo(
    () => selectableGroups.flatMap((group) => group.items.map((item) => item.id)),
    [selectableGroups]
  )

  const selectionTargets = useMemo(() => {
    if (!selectedElement) {
      return [] as string[]
    }
    if (selectedElement === BULK_ALL) {
      return selectableElements.filter((id) => !id.startsWith('__bulk_') && id !== 'chartRoot')
    }
    if (selectedElement === BULK_PLANETS) {
      return selectableElements.filter(
        (id) => id.startsWith('planet.') && id.endsWith('.glyph')
      )
    }
    if (selectedElement === BULK_SIGNS) {
      return selectableElements.filter((id) => id.startsWith('sign.'))
    }
    if (selectedElement === BULK_GLYPHS) {
      return selectableElements.filter(
        (id) =>
          (id.startsWith('planet.') && id.endsWith('.glyph')) ||
          id.startsWith('sign.') ||
          id === 'asc.marker'
      )
    }
    if (selectedElement === 'chartRoot') {
      return selectableElements.filter(
        (id) => !id.startsWith('__bulk_') && id !== 'chartRoot' && id !== CHART_BACKGROUND_ID
      )
    }
    if (selectedElement === CHART_BACKGROUND_ID) {
      return [CHART_BACKGROUND_ID]
    }
    if (selectedElement === BACKGROUND_IMAGE_ID) {
      return [BACKGROUND_IMAGE_ID]
    }
    return [selectedElement]
  }, [selectableElements, selectedElement])

  const selectionColor = useMemo(() => {
    if (selectionTargets.length === 0) {
      return ''
    }
    const colors = selectionTargets.map((id) => overrides[id]?.color || '')
    const first = colors[0]
    return colors.every((color) => color === first) ? first : ''
  }, [overrides, selectionTargets])

  const selectionColorMixed = useMemo(() => {
    if (selectionTargets.length <= 1) {
      return false
    }
    const colors = selectionTargets.map((id) => overrides[id]?.color || '')
    const first = colors[0]
    return colors.some((color) => color !== first)
  }, [overrides, selectionTargets])

  const selectionEnabled = selectionTargets.length > 0

  const setSelectedElement = (value: string) => {
    dispatch({ type: 'SET_SELECTED_ELEMENT', id: value })
    let nextLayer: ActiveSelectionLayer = 'auto'
    if (
      value &&
      (value === 'chartRoot' ||
        value === BULK_ALL ||
        value === BULK_PLANETS ||
        value === BULK_SIGNS ||
        value === BULK_GLYPHS ||
        isDraggableElement(value))
    ) {
      nextLayer = 'chart'
    } else if (value === BACKGROUND_IMAGE_ID) {
      nextLayer = 'background_image'
    }
    dispatch({ type: 'SET_ACTIVE_SELECTION_LAYER', layer: nextLayer })
  }

  const applySelectionColor = (color: string | null) => {
    if (selectionTargets.length === 0) {
      return
    }
    dispatch({ type: 'APPLY_COLOR', targets: selectionTargets, color })
  }

  return {
    selectableGroups,
    selectableIds: selectableElements,
    selectionTargets,
    selectionColor,
    selectionColorMixed,
    selectionEnabled,
    setSelectedElement,
    applySelectionColor,
    bulkIds: {
      all: BULK_ALL,
      planets: BULK_PLANETS,
      signs: BULK_SIGNS,
      glyphs: BULK_GLYPHS,
    },
    chartBackgroundId: CHART_BACKGROUND_ID,
  }
}
