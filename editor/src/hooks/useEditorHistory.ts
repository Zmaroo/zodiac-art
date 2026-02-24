import { useEffect } from 'react'
import { useUndoRedo } from './useUndoRedo'
import type { ChartFit, DesignSettings, Offset } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseEditorHistoryParams = {
  chartFit: ChartFit
  overrides: Record<string, Offset>
  design: DesignSettings
  dispatch: (action: EditorAction) => void
  resetKey: string
}

type UseEditorHistoryResult = {
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
}

export function useEditorHistory(params: UseEditorHistoryParams): UseEditorHistoryResult {
  const { chartFit, overrides, design, dispatch, resetKey } = params
  const { canUndo, canRedo, undo, redo } = useUndoRedo({
    chartFit,
    overrides,
    design,
    dispatch,
    resetKey,
  })

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const metaKey = event.metaKey || event.ctrlKey
      if (!metaKey) {
        return
      }
      if (!event.shiftKey && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
        return
      }
      if ((event.shiftKey && event.key.toLowerCase() === 'z') || event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [redo, undo])

  return { canUndo, canRedo, undo, redo }
}
