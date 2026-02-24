import { useEffect } from 'react'
import type { ChartFit, DesignSettings, FrameCircle } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseEditorResetEffectsParams = {
  isChartOnly: boolean
  chartId: string
  selectedId: string
  hasSavedFit: boolean
  defaultChartFit: ChartFit
  defaultDesign: DesignSettings
  dispatch: (action: EditorAction) => void
  setFrameCircle: (value: FrameCircle | null) => void
}

export function useEditorResetEffects(params: UseEditorResetEffectsParams) {
  const {
    isChartOnly,
    chartId,
    selectedId,
    hasSavedFit,
    defaultChartFit,
    defaultDesign,
    dispatch,
    setFrameCircle,
  } = params

  useEffect(() => {
    dispatch({ type: 'RESET_USER_ADJUSTED' })
  }, [chartId, dispatch, selectedId])

  useEffect(() => {
    if (isChartOnly && !chartId) {
      dispatch({ type: 'LOAD_LAYOUT', fit: defaultChartFit, overrides: {}, design: defaultDesign })
      setFrameCircle(null)
    }
  }, [chartId, defaultChartFit, defaultDesign, dispatch, isChartOnly, setFrameCircle])

  useEffect(() => {
    dispatch({ type: 'SET_USER_ADJUSTED', value: hasSavedFit })
  }, [dispatch, hasSavedFit])
}
