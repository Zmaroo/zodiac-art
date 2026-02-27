import { useMemo } from 'react'

import type { EditorDoc } from '../types'

type UseEditorSyncParams = {
  jwt: string
  doc: EditorDoc
  draftKey: string
}

type UseEditorSyncResult = {
  syncStatus: string
}

export function useEditorSync(params: UseEditorSyncParams): UseEditorSyncResult {
  const {
    jwt,
    doc,
    draftKey,
  } = params

  const syncStatus = useMemo(() => {
    if (!draftKey) {
      return ''
    }
    if (!jwt) {
      return 'Offline'
    }
    if (!doc.chart_id) {
      return ''
    }
    if (!doc.is_chart_only && !doc.frame_id) {
      return ''
    }
    if (doc.client_version <= doc.server_version) {
      return doc.last_synced_at ? 'Saved' : ''
    }
    return 'Unsaved changes'
  }, [doc, draftKey, jwt])

  return { syncStatus }
}
