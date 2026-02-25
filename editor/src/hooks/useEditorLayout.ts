import { useEffect, useRef } from 'react'
import type { MutableRefObject } from 'react'
import type {
  ChartFit,
  ChartOccluder,
  DesignSettings,
  EditorDraft,
  FrameCircle,
  Offset,
} from '../types'
import type { EditorAction } from '../state/editorReducer'

type LayoutResult = {
  fit: ChartFit
  overrides: Record<string, Offset>
  frameCircle: FrameCircle | null
  design: DesignSettings
  userAdjustedFit: boolean
  occluders: ChartOccluder[]
}

type UseEditorLayoutParams = {
  draftKey: string
  draftState: EditorDraft | null
  draftAppliedRef: MutableRefObject<boolean>
  dispatch: (action: EditorAction) => void
  setFrameCircle: (circle: FrameCircle | null) => void
}

type UseEditorLayoutResult = {
  handleLayoutLoaded: (result: LayoutResult) => void
}

export function useEditorLayout(params: UseEditorLayoutParams): UseEditorLayoutResult {
  const { draftKey, draftState, draftAppliedRef, dispatch, setFrameCircle } = params
  const layoutAppliedRef = useRef(false)

  useEffect(() => {
    layoutAppliedRef.current = false
  }, [draftKey])

  const handleLayoutLoaded = (result: LayoutResult) => {
    const draftIsNewer =
      draftState && draftState.key === draftKey && draftState.client_version > draftState.server_version
    if (draftIsNewer) {
      if (!draftAppliedRef.current) {
        dispatch({
          type: 'APPLY_DRAFT',
          fit: draftState.chart_fit,
          overrides: draftState.overrides,
          design: draftState.design,
          frameCircle: draftState.frame_circle,
          occluders: draftState.chart_occluders ?? [],
          clientVersion: draftState.client_version,
          serverVersion: draftState.server_version,
          lastSavedAt: draftState.last_saved_at,
          lastSyncedAt: draftState.last_synced_at,
        })
        draftAppliedRef.current = true
      }
      setFrameCircle(draftState.frame_circle ?? result.frameCircle)
      return
    }
    if (layoutAppliedRef.current) {
      return
    }
    layoutAppliedRef.current = true
    dispatch({
      type: 'LOAD_LAYOUT',
      fit: result.fit,
      overrides: result.overrides,
      design: result.design,
      userAdjustedFit: result.userAdjustedFit,
      occluders: result.occluders,
    })
    setFrameCircle(result.frameCircle)
  }

  return { handleLayoutLoaded }
}
