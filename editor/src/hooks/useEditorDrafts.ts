import { useEffect, useMemo, useRef, useState } from 'react'
import type { MutableRefObject } from 'react'
import { deleteDraft, getDraft, setDraft } from '../utils/drafts'
import type { EditorDoc, EditorDraft } from '../types'

type UseEditorDraftsParams = {
  doc: EditorDoc
}

type UseEditorDraftsResult = {
  draftKey: string
  draftStatus: string
  draftInfo: string
  draftState: EditorDraft | null
  draftAppliedRef: MutableRefObject<boolean>
}

export function useEditorDrafts(params: UseEditorDraftsParams): UseEditorDraftsResult {
  const { doc } = params
  const [draftStatus, setDraftStatus] = useState('')
  const [lastDraftAt, setLastDraftAt] = useState<number | null>(null)
  const [draftState, setDraftState] = useState<EditorDraft | null>(null)
  const draftAppliedRef = useRef(false)
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (!draftKey) {
      return
    }
    if (doc.client_version <= doc.server_version) {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current)
      }
      if (doc.last_saved_at) {
        deleteDraft(draftKey).catch(() => undefined)
        queueMicrotask(() => {
          setLastDraftAt(null)
          setDraftStatus('')
          setDraftState(null)
        })
      }
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
      frame_mask_cutoff: doc.frame_mask_cutoff,
      frame_mask_offwhite_boost: doc.frame_mask_offwhite_boost,
      client_version: doc.client_version,
      server_version: doc.server_version,
      last_saved_at: doc.last_saved_at,
      last_synced_at: doc.last_synced_at,
    }
    if (draftTimerRef.current) {
      clearTimeout(draftTimerRef.current)
    }
    draftTimerRef.current = setTimeout(() => {
      setDraft(draftKey, payload)
        .then(() => {
          setLastDraftAt(Date.now())
          setDraftStatus('')
          setDraftState(payload)
        })
        .catch(() => setDraftStatus('Draft save failed.'))
    }, 350)
    return () => {
      if (draftTimerRef.current) {
        clearTimeout(draftTimerRef.current)
      }
    }
  }, [doc, draftKey])

  const draftInfo = lastDraftAt ? 'Draft saved locally' : ''

  return { draftKey, draftStatus, draftInfo, draftState, draftAppliedRef }
}
