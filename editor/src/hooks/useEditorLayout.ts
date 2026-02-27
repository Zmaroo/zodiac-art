import { useEffect, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import type {
  ChartFit,
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
  onDraftFrameCircleApplied: (circle: FrameCircle | null) => void
}

type UseEditorLayoutResult = {
  handleLayoutLoaded: (result: LayoutResult) => void
  draftPrompt: {
    visible: boolean
    onRestore: () => void
    onDiscard: () => void
  }
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
    onDraftFrameCircleApplied,
  } = params
  const layoutAppliedRef = useRef(false)
  const layoutResultRef = useRef<LayoutResult | null>(null)
  const [draftPromptVisible, setDraftPromptVisible] = useState(false)

  useEffect(() => {
    layoutAppliedRef.current = false
    layoutResultRef.current = null
    setDraftPromptVisible(false)
  }, [draftKey])

  const applyLayoutResult = (result: LayoutResult) => {
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
    if ((result.frameMaskCutoff ?? 255) < 255 && result.frameCircle) {
      dispatch({ type: 'SET_ACTIVE_SELECTION_LAYER', layer: 'frame_mask' })
    }
  }

  const applyDraft = () => {
    if (!draftState) {
      return
    }
    const layoutResult = layoutResultRef.current
    dispatch({
      type: 'APPLY_DRAFT',
      fit: draftState.chart_fit,
      overrides: draftState.overrides,
      design: draftState.design,
      frameCircle: draftState.frame_circle,
      clientVersion: draftState.client_version,
      serverVersion: draftState.server_version,
      lastSavedAt: draftState.last_saved_at,
      lastSyncedAt: draftState.last_synced_at,
    })
    draftAppliedRef.current = true
    onDraftFrameCircleApplied(draftState.frame_circle ?? null)
    if (draftState.frame_circle === null) {
      setFrameCircleFromUser(null)
    } else {
      setFrameCircleFromUser(draftState.frame_circle ?? layoutResult?.frameCircle ?? null)
    }
    if (typeof draftState.frame_mask_cutoff === 'number') {
      setFrameMaskCutoff(draftState.frame_mask_cutoff)
    }
    if (typeof draftState.frame_mask_offwhite_boost === 'number') {
      setFrameMaskOffwhiteBoost(draftState.frame_mask_offwhite_boost)
    }
    const shouldEditMask =
      (draftState.frame_mask_cutoff ?? 255) < 255 && Boolean(draftState.frame_circle)
    if (shouldEditMask) {
      setFrameMaskCutoff(draftState.frame_mask_cutoff ?? 252)
      setFrameMaskOffwhiteBoost(draftState.frame_mask_offwhite_boost ?? 20)
    }
    dispatch({ type: 'SET_ACTIVE_SELECTION_LAYER', layer: shouldEditMask ? 'frame_mask' : 'auto' })
  }

  const handleLayoutLoaded = (result: LayoutResult) => {
    layoutResultRef.current = result
    applyLayoutResult(result)
    const draftIsNewer =
      draftState && draftState.key === draftKey && draftState.client_version > draftState.server_version
    if (draftIsNewer && !draftAppliedRef.current) {
      setDraftPromptVisible(true)
    }
  }

  useEffect(() => {
    const draftIsNewer =
      draftState && draftState.key === draftKey && draftState.client_version > draftState.server_version
    if (!draftIsNewer || draftAppliedRef.current || draftPromptVisible) {
      return
    }
    if (!layoutResultRef.current) {
      return
    }
    setDraftPromptVisible(true)
  }, [draftKey, draftPromptVisible, draftState])

  useEffect(() => {
    if (!draftPromptVisible) {
      return
    }
    const draftIsNewer =
      draftState && draftState.key === draftKey && draftState.client_version > draftState.server_version
    if (!draftIsNewer) {
      setDraftPromptVisible(false)
    }
  }, [draftKey, draftPromptVisible, draftState])

  return {
    handleLayoutLoaded,
    draftPrompt: {
      visible: draftPromptVisible,
      onRestore: () => {
        setDraftPromptVisible(false)
        applyDraft()
      },
      onDiscard: () => {
        setDraftPromptVisible(false)
        draftAppliedRef.current = true
        deleteDraft(draftKey).catch(() => undefined)
      },
    },
  }
}
