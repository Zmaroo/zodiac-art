import type { Dispatch } from 'react'
import type { ChartMeta, FrameCircle } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseEditorActionsParams = {
  isChartOnly: boolean
  meta: ChartMeta | null
  frameCircle: FrameCircle | null
  computeFitFromCircle: (metaData: ChartMeta, circle: FrameCircle) => {
    dx: number
    dy: number
    scale: number
    rotation_deg: number
  }
  dispatch: Dispatch<EditorAction>
  setError: (value: string) => void
  setStatus: (value: string) => void
  clearActionsMessages: () => void
  saveAll: () => Promise<void>
}

export function useEditorActions(params: UseEditorActionsParams) {
  const {
    isChartOnly,
    meta,
    frameCircle,
    computeFitFromCircle,
    dispatch,
    setError,
    setStatus,
  clearActionsMessages,
  saveAll,
} = params

  const handleAutoFit = () => {
    clearActionsMessages()
    if (isChartOnly) {
      setError('Auto-fit requires a frame selection.')
      return
    }
    if (!meta || !frameCircle) {
      setError('Frame circle not available yet.')
      return
    }
    const fit = computeFitFromCircle(meta, frameCircle)
    dispatch({ type: 'AUTO_FIT_APPLIED', fit })
    setError('')
    setStatus('Auto-fit applied.')
  }

  const handleResetToSavedFit = () => {
    clearActionsMessages()
    dispatch({ type: 'RESET_TO_SAVED' })
    setError('')
    setStatus('Reverted to saved fit.')
  }

  const handleSaveAllClick = async () => {
    clearActionsMessages()
    await saveAll()
  }

  const handleResetView = () => {
    clearActionsMessages()
    dispatch({ type: 'RESET_TO_INITIAL' })
  }

  return {
    handleAutoFit,
    handleResetToSavedFit,
    handleSaveAllClick,
    handleResetView,
  }
}
