import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { getDraft, setDraft } from '../utils/drafts'
import type { EditorDoc, EditorDraft, FrameCircle } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseEditorDraftsParams = {
  doc: EditorDoc
  dispatch: (action: EditorAction) => void
  setFrameCircle: (circle: FrameCircle | null) => void
}

type UseEditorDraftsResult = {
  draftKey: string
  draftStatus: string
  draftInfo: string
  draftState: EditorDraft | null
  draftAppliedRef: MutableRefObject<boolean>
}

export function useEditorDrafts(params: UseEditorDraftsParams): UseEditorDraftsResult {
  const {
    doc,
    dispatch,
    setFrameCircle,
  } = params
  const [draftStatus, setDraftStatus] = useState('')
  const [lastDraftAt, setLastDraftAt] = useState<number | null>(null)
  const [draftState, setDraftState] = useState<EditorDraft | null>(null)
  const draftAppliedRef = useRef(false)

  const draftKey = useMemo(() => {
    if (!doc.chart_id) {
      return ''
    }
    if (doc.is_chart_only) {
      return `chart:${doc.chart_id}:chart_only`
    }
    if (!doc.frame_id) {
      return ''
    }
    return `chart:${doc.chart_id}:frame:${doc.frame_id}`
  }, [doc.chart_id, doc.frame_id, doc.is_chart_only])

  useEffect(() => {
    draftAppliedRef.current = false
    if (!draftKey) {
      queueMicrotask(() => {
        setDraftState(null)
      })
      return
    }
    let cancelled = false
    getDraft<EditorDraft>(draftKey)
      .then((draft) => {
        if (cancelled) {
          return
        }
        setDraftState(draft)
      })
      .catch(() => {
        if (!cancelled) {
          setDraftState(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [draftKey])

  useEffect(() => {
    if (!draftKey || !draftState || draftAppliedRef.current) {
      return
    }
    if (draftState.client_version <= draftState.server_version) {
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
    if (draftState.frame_circle) {
      setFrameCircle(draftState.frame_circle)
    }
    draftAppliedRef.current = true
  }, [dispatch, draftKey, draftState, setFrameCircle])

  useEffect(() => {
    if (!draftKey) {
      return
    }
    const payload: EditorDraft = {
      key: draftKey,
      chart_id: doc.chart_id,
      frame_id: doc.frame_id,
      is_chart_only: doc.is_chart_only,
      chart_fit: doc.chart_fit,
      overrides: doc.overrides,
      design: doc.design,
      frame_circle: doc.frame_circle,
      chart_occluders: doc.chart_occluders,
      client_version: doc.client_version,
      server_version: doc.server_version,
      last_saved_at: doc.last_saved_at,
      last_synced_at: doc.last_synced_at,
    }
    const timeout = window.setTimeout(() => {
      setDraft(draftKey, payload)
        .then(() => {
          setLastDraftAt(Date.now())
          setDraftStatus('')
        })
        .catch(() => setDraftStatus('Draft save failed.'))
    }, 500)
    return () => window.clearTimeout(timeout)
  }, [
    doc,
    draftKey,
  ])

  const draftInfo = lastDraftAt ? 'Draft saved locally' : ''

  return { draftKey, draftStatus, draftInfo, draftState, draftAppliedRef }
}
