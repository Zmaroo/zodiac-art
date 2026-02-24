import { useMemo } from 'react'
import type { ChartFit, DesignSettings, EditorDoc, FrameCircle, Offset } from '../types'

type UseEditorDocParams = {
  chartId: string
  selectedId: string
  isChartOnly: boolean
  chartFit: ChartFit
  overrides: Record<string, Offset>
  design: DesignSettings
  frameCircle: FrameCircle | null
  clientVersion: number
  serverVersion: number
  lastSavedAt: number | null
  lastSyncedAt: number | null
}

export function useEditorDoc(params: UseEditorDocParams): EditorDoc {
  const {
    chartId,
    selectedId,
    isChartOnly,
    chartFit,
    overrides,
    design,
    frameCircle,
    clientVersion,
    serverVersion,
    lastSavedAt,
    lastSyncedAt,
  } = params
  return useMemo(
    () => ({
      chart_id: chartId,
      frame_id: isChartOnly ? null : selectedId || null,
      is_chart_only: isChartOnly,
      chart_fit: chartFit,
      overrides,
      design,
      frame_circle: frameCircle,
      client_version: clientVersion,
      server_version: serverVersion,
      last_saved_at: lastSavedAt,
      last_synced_at: lastSyncedAt,
    }),
    [
      chartFit,
      chartId,
      clientVersion,
      design,
      frameCircle,
      isChartOnly,
      lastSavedAt,
      lastSyncedAt,
      overrides,
      selectedId,
      serverVersion,
    ]
  )
}
