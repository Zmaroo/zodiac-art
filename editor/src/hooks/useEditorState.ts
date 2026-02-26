import { useReducer, useState } from 'react'
import { createInitialEditorState, editorReducer } from '../state/editorReducer'
import { usePersistedState } from './usePersistedState'
import { DEFAULT_CHART_FIT, DEFAULT_DESIGN } from '../editor/constants'

export function useEditorState() {
  const [editorState, dispatch] = useReducer(
    editorReducer,
    createInitialEditorState(DEFAULT_CHART_FIT, DEFAULT_DESIGN)
  )
  const chartLinesColor = editorState.overrides['chart.lines']?.color ?? ''
  const [showFrameCircleDebug, setShowFrameCircleDebug] = useState(false)
  const [frameMaskCutoff, setFrameMaskCutoff] = usePersistedState(
    'zodiac_editor.frameMaskCutoff',
    252,
    (raw) => {
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : 252
    },
    (value) => String(value)
  )
  const [frameMaskOffwhiteBoost, setFrameMaskOffwhiteBoost] = usePersistedState(
    'zodiac_editor.frameMaskOffwhiteBoost',
    20,
    (raw) => {
      const parsed = Number(raw)
      return Number.isFinite(parsed) ? parsed : 20
    },
    (value) => String(value)
  )
  const [radialMoveEnabled, setRadialMoveEnabled] = usePersistedState(
    'zodiac_editor.radialMoveEnabled',
    true,
    (raw) => raw === '1',
    (value) => (value ? '1' : '0')
  )
  const [frameMaskGuideVisible, setFrameMaskGuideVisible] = usePersistedState(
    'zodiac_editor.frameMaskGuideVisible',
    true,
    (raw) => raw !== '0',
    (value) => (value ? '1' : '0')
  )
  const [frameMaskLockAspect, setFrameMaskLockAspect] = usePersistedState(
    'zodiac_editor.frameMaskLockAspect',
    false,
    (raw) => raw === '1',
    (value) => (value ? '1' : '0')
  )

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
