import { useEffect, useRef, useState } from 'react'

import type { EditorDoc } from '../types'

type UseEditorSyncParams = {
  jwt: string
  doc: EditorDoc
  saveAll: () => Promise<void>
  draftKey: string
}

type UseEditorSyncResult = {
  syncStatus: string
  syncEnabled: boolean
  handleSyncNow: () => Promise<void>
}

export function useEditorSync(params: UseEditorSyncParams): UseEditorSyncResult {
  const {
    jwt,
    doc,
    saveAll,
    draftKey,
  } = params
  const [syncStatus, setSyncStatus] = useState('')
  const syncInFlightRef = useRef(false)
  const syncEnabled = Boolean(jwt && doc.chart_id && (doc.is_chart_only || doc.frame_id))

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
        setSyncStatus('Synced')
      } else {
        setSyncStatus('')
      }
      return
    }
    setSyncStatus('Unsynced changes')
    const timeout = window.setTimeout(async () => {
      if (syncInFlightRef.current) {
        return
      }
      syncInFlightRef.current = true
      setSyncStatus('Syncing...')
      try {
        await saveAll()
        setSyncStatus('Synced')
      } finally {
        syncInFlightRef.current = false
      }
    }, 2500)
    return () => window.clearTimeout(timeout)
  }, [
    doc,
    draftKey,
    jwt,
    saveAll,
  ])

  const handleSyncNow = async () => {
    if (!syncEnabled) {
      setSyncStatus('Offline')
      return
    }
    if (syncInFlightRef.current) {
      return
    }
    syncInFlightRef.current = true
    setSyncStatus('Syncing...')
    try {
      await saveAll()
      setSyncStatus('Synced')
    } finally {
      syncInFlightRef.current = false
    }
  }

  return { syncStatus, syncEnabled, handleSyncNow }
}
