import { useEffect, useState } from 'react'

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
  const [syncStatus, setSyncStatus] = useState('')

  useEffect(() => {
    if (!draftKey) {
      setSyncStatus('')
      return
    }
    if (!jwt) {
      setSyncStatus('Offline')
      return
    }
    if (!doc.chart_id) {
      return
    }
    if (!doc.is_chart_only && !doc.frame_id) {
      return
    }
    if (doc.client_version <= doc.server_version) {
      if (doc.last_synced_at) {
        setSyncStatus('Saved')
      } else {
        setSyncStatus('')
      }
      return
    }
    setSyncStatus('Unsaved changes')
  }, [doc, draftKey, jwt])

  return { syncStatus }
}
