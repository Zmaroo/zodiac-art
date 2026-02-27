import { useReducer, useState } from 'react'
import { createInitialEditorState, editorReducer } from '../state/editorReducer'
import { DEFAULT_CHART_FIT, DEFAULT_DESIGN } from '../editor/constants'

export function useEditorState() {
  const [editorState, dispatch] = useReducer(
    editorReducer,
    createInitialEditorState(DEFAULT_CHART_FIT, DEFAULT_DESIGN)
  )
  const chartLinesColor = editorState.overrides['chart.lines']?.color ?? ''
  const [showFrameCircleDebug, setShowFrameCircleDebug] = useState(false)
  const [frameMaskCutoff, setFrameMaskCutoff] = useState(255)
  const [frameMaskOffwhiteBoost, setFrameMaskOffwhiteBoost] = useState(20)
  const [radialMoveEnabled, setRadialMoveEnabled] = useState(true)
  const [frameMaskGuideVisible, setFrameMaskGuideVisible] = useState(true)
  const [frameMaskLockAspect, setFrameMaskLockAspect] = useState(false)


  return {
    editorState,
    dispatch,
    chartLinesColor,
    showFrameCircleDebug,
    setShowFrameCircleDebug,
    frameMaskCutoff,
    setFrameMaskCutoff,
    frameMaskOffwhiteBoost,
    setFrameMaskOffwhiteBoost,
    radialMoveEnabled,
    setRadialMoveEnabled,
    frameMaskGuideVisible,
    setFrameMaskGuideVisible,
    frameMaskLockAspect,
    setFrameMaskLockAspect,
  }
}
