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
import { deleteDraft } from '../utils/drafts'

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

type UseEditorLayoutParams = {
  draftKey: string
  draftState: EditorDraft | null
  draftAppliedRef: MutableRefObject<boolean>
  dispatch: (action: EditorAction) => void
  setFrameCircle: (circle: FrameCircle | null) => void
  setFrameCircleFromUser: (circle: FrameCircle | null) => void
  frameMaskEnabled: boolean
  setFrameMaskCutoff: (value: number) => void
  setFrameMaskOffwhiteBoost: (value: number) => void
}

type UseEditorLayoutResult = {
  handleLayoutLoaded: (result: LayoutResult) => void
}

export function useEditorLayout(params: UseEditorLayoutParams): UseEditorLayoutResult {
  const {
    draftKey,
    draftState,
    draftAppliedRef,
    dispatch,
    setFrameCircle,
    setFrameCircleFromUser,
    frameMaskEnabled,
    setFrameMaskCutoff,
    setFrameMaskOffwhiteBoost,
  } = params
  const layoutAppliedRef = useRef(false)

  useEffect(() => {
    layoutAppliedRef.current = false
  }, [draftKey])

  const handleLayoutLoaded = (result: LayoutResult) => {
    const draftIsNewer =
      draftState && draftState.key === draftKey && draftState.client_version > draftState.server_version
    if (draftIsNewer) {
      if (draftAppliedRef.current) {
        return
      }
      const restoreDraft = window.confirm(
        'Unsaved local changes were found for this chart. Restore them?'
      )
      if (!restoreDraft) {
        draftAppliedRef.current = true
        deleteDraft(draftKey).catch(() => undefined)
        return
      }
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
      if (draftState.frame_circle === null) {
        setFrameCircleFromUser(null)
      } else {
        setFrameCircle(draftState.frame_circle ?? result.frameCircle)
      }
      if (typeof draftState.frame_mask_cutoff === 'number') {
        setFrameMaskCutoff(draftState.frame_mask_cutoff)
      }
      if (typeof draftState.frame_mask_offwhite_boost === 'number') {
        setFrameMaskOffwhiteBoost(draftState.frame_mask_offwhite_boost)
      }
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
    if (result.frameCircleExplicit && result.frameCircle === null) {
      if (frameMaskEnabled) {
        setFrameCircle(null)
        return
      }
      setFrameCircleFromUser(null)
    } else {
      setFrameCircle(result.frameCircle)
    }
    if (typeof result.frameMaskCutoff === 'number') {
      setFrameMaskCutoff(result.frameMaskCutoff)
    }
    if (typeof result.frameMaskOffwhiteBoost === 'number') {
      setFrameMaskOffwhiteBoost(result.frameMaskOffwhiteBoost)
    }
  }

  return { handleLayoutLoaded }
}
