import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDebouncedValue } from './useDebouncedValue'
import { useChartSvg } from './useChartSvg'
import { useFrameCircle } from './useFrameCircle'
import { useEditorDoc } from './useEditorDoc'
import { useEditorDrafts } from './useEditorDrafts'
import { useEditorLayout } from './useEditorLayout'
import { useChartBackground } from './useChartBackground'
import { applyOverrides, stripElementById } from '../utils/svg'
import type {
  ChartFit,
  ChartOccluder,
  DesignSettings,
  EditorDoc,
  FrameCircle,
  Offset,
} from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseEditorLayoutPipelineParams = {
  apiBase: string
  jwt: string
  chartId: string
  selectedId: string
  isChartOnly: boolean
  design: DesignSettings
  overrides: Record<string, Offset>
  chartFit: ChartFit
  chartOccluders: ChartOccluder[]
  frameMaskCutoff: number
  frameMaskOffwhiteBoost: number
  clientVersion: number
  serverVersion: number
  lastSavedAt: number | null
  lastSyncedAt: number | null
  defaultDesign: DesignSettings
  chartBackgroundId: string
  dispatch: (action: EditorAction) => void
  setFrameMaskCutoff: (value: number) => void
  setFrameMaskOffwhiteBoost: (value: number) => void
}

export function useEditorLayoutPipeline(params: UseEditorLayoutPipelineParams) {
  const {
    apiBase,
    jwt,
    chartId,
    selectedId,
    isChartOnly,
    design,
    overrides,
    chartFit,
    chartOccluders,
    frameMaskCutoff,
    frameMaskOffwhiteBoost,
    clientVersion,
    serverVersion,
    lastSavedAt,
    lastSyncedAt,
    defaultDesign,
    chartBackgroundId,
    dispatch,
    setFrameMaskCutoff,
    setFrameMaskOffwhiteBoost,
  } = params

  type LayoutResult = {
    fit: ChartFit
    overrides: Record<string, Offset>
    frameCircle: FrameCircle | null
    frameCircleExplicit: boolean
    design: DesignSettings
    userAdjustedFit: boolean
    occluders: ChartOccluder[]
    frameMaskCutoff?: number
    frameMaskOffwhiteBoost?: number
  }
  const frameMaskEnabled = frameMaskCutoff < 255
  const [frameCircleLocked, setFrameCircleLocked] = useState(false)
  const noopLayoutHandler = (result: LayoutResult) => {
    void result
  }
  const layoutHandlerRef = useRef<(result: LayoutResult) => void>(noopLayoutHandler)
  const pendingLayoutRef = useRef<LayoutResult | null>(null)
  const handleLayoutLoadedProxy = useCallback((result: LayoutResult) => {
    setFrameCircleLocked(result.frameCircleExplicit && result.frameCircle === null && !frameMaskEnabled)
    if (layoutHandlerRef.current === noopLayoutHandler) {
      pendingLayoutRef.current = result
      return
    }
    layoutHandlerRef.current(result)
  }, [frameMaskEnabled])

  const debouncedDesign = useDebouncedValue(design, 400)
  const {
    meta,
    selectedFrameDetail,
    chartSvgBase,
    hasSavedFit,
    error: chartSvgError,
  } = useChartSvg({
    apiBase,
    jwt,
    chartId,
    selectedId,
    isChartOnly,
    designPreview: debouncedDesign,
    defaultDesign,
    onLayoutLoaded: handleLayoutLoadedProxy,
  })

  const {
    frameCircle,
    setFrameCircle,
    setFrameCircleFromUser,
    resetFrameCircleAuto,
    error: frameCircleError,
    status: frameCircleStatus,
    clearStatus: clearFrameCircleStatus,
    snapFrameMask,
  } = useFrameCircle({
    apiBase,
    selectedFrameDetail,
    frameCircleLocked,
  })
  const setFrameCircleFromUserWithVersion = (circle: FrameCircle | null) => {
    setFrameCircleFromUser(circle)
    dispatch({ type: 'BUMP_CLIENT_VERSION' })
  }
  const resetFrameCircleAutoWithVersion = () => {
    setFrameCircleLocked(false)
    resetFrameCircleAuto()
    dispatch({ type: 'BUMP_CLIENT_VERSION' })
  }
  const snapFrameMaskFromUser = (whiteCutoff: number, offwhiteBoost: number) => {
    snapFrameMask(whiteCutoff, offwhiteBoost)
    dispatch({ type: 'BUMP_CLIENT_VERSION' })
  }

  const editorDoc: EditorDoc = useEditorDoc({
    chartId,
    selectedId,
    isChartOnly,
    chartFit,
    overrides,
    design,
    frameCircle,
    chartOccluders,
    frameMaskCutoff,
    frameMaskOffwhiteBoost,
    clientVersion,
    serverVersion,
    lastSavedAt,
    lastSyncedAt,
  })

  const { draftKey, draftStatus, draftInfo, draftState, draftAppliedRef } = useEditorDrafts({
    doc: editorDoc,
    dispatch,
    setFrameCircle,
    setFrameMaskCutoff,
    setFrameMaskOffwhiteBoost,
  })

  const { handleLayoutLoaded: layoutHandler } = useEditorLayout({
    draftKey,
    draftState,
    draftAppliedRef,
    dispatch,
    setFrameCircle,
    setFrameCircleFromUser,
    frameMaskEnabled,
    setFrameMaskCutoff,
    setFrameMaskOffwhiteBoost,
  })
  useEffect(() => {
    layoutHandlerRef.current = layoutHandler
    if (pendingLayoutRef.current) {
      const pending = pendingLayoutRef.current
      pendingLayoutRef.current = null
      layoutHandlerRef.current(pending)
    }
  }, [layoutHandler])

  const { chartBackgroundColor } = useChartBackground({
    chartSvgBase,
    overrides,
    chartBackgroundId,
  })

  const chartSvg = useMemo(() => {
    if (!chartSvgBase) {
      return ''
    }
    const base = chartBackgroundColor ? stripElementById(chartSvgBase, chartBackgroundId) : chartSvgBase
    return applyOverrides(base, overrides)
  }, [chartBackgroundColor, chartBackgroundId, chartSvgBase, overrides])

  return {
    meta,
    selectedFrameDetail,
    chartSvg,
    chartSvgError,
    hasSavedFit,
    frameCircle,
    setFrameCircle,
    setFrameCircleFromUser: setFrameCircleFromUserWithVersion,
    resetFrameCircleAuto: resetFrameCircleAutoWithVersion,
    frameCircleError,
    frameCircleStatus,
    clearFrameCircleStatus,
    snapFrameMask: snapFrameMaskFromUser,
    editorDoc,
    draftKey,
    draftStatus,
    draftInfo,
    chartBackgroundColor,
  }
}
