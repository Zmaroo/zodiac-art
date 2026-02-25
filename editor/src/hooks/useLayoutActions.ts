import { apiFetch, readApiError } from '../api/client'
import { normalizeOverride, round } from '../utils/format'
import type { ChartFit, ChartMeta, ChartOccluder, DesignSettings, FrameCircle, Offset } from '../types'
import type { EditorAction } from '../state/editorReducer'

type UseLayoutActionsParams = {
  apiBase: string
  jwt: string
  chartId: string
  selectedId: string
  isChartOnly: boolean
  meta: ChartMeta | null
  chartFit: ChartFit
  overrides: Record<string, Offset>
  design: DesignSettings
  frameCircle: FrameCircle | null
  chartOccluders: ChartOccluder[]
  clientVersion: number
  setError: (value: string) => void
  setStatus: (value: string) => void
  dispatch: (action: EditorAction) => void
}

export function useLayoutActions(params: UseLayoutActionsParams) {
  const {
    apiBase,
    jwt,
    chartId,
    selectedId,
    isChartOnly,
    meta,
    chartFit,
    overrides,
    design,
    frameCircle,
    chartOccluders,
    clientVersion,
    setError,
    setStatus,
    dispatch,
  } = params

  const apiFetchWithAuth = (url: string, init: RequestInit = {}) => apiFetch(url, jwt, init)

  const saveAll = async () => {
    if (!jwt) {
      setError('Login required to save changes.')
      return
    }
    if (!chartId) {
      setError('Chart ID is required to save changes.')
      return
    }
    if (isChartOnly) {
      const chartFitPayload = {
        dx: round(chartFit.dx),
        dy: round(chartFit.dy),
        scale: round(chartFit.scale),
        rotation_deg: round(chartFit.rotation_deg),
      }
      const layoutPayload = {
        overrides: Object.fromEntries(
          Object.entries(overrides).map(([key, value]) => [
            key,
            normalizeOverride(value),
          ])
        ),
        design,
        chart_occluders: chartOccluders,
      }
      const fitResponse = await apiFetchWithAuth(`${apiBase}/api/charts/${chartId}/chart_fit`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chartFitPayload),
      })
      if (!fitResponse.ok) {
        const detail = await readApiError(fitResponse)
        setError(detail ?? 'Failed to save chart-only fit.')
        setStatus('')
        return
      }
      const layoutResponse = await apiFetchWithAuth(`${apiBase}/api/charts/${chartId}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutPayload),
      })
      if (!layoutResponse.ok) {
        const detail = await readApiError(layoutResponse)
        setError(detail ?? 'Failed to save chart-only layout.')
        setStatus('')
        return
      }
      dispatch({ type: 'SET_SAVED_FIT', fit: chartFit })
      dispatch({ type: 'MARK_SYNCED', version: clientVersion, savedAt: Date.now() })
      setError('')
      setStatus('Saved chart-only layout.')
      return
    }
    if (!meta || !selectedId) {
      return
    }
    const chartFitPayload = {
      dx: round(chartFit.dx),
      dy: round(chartFit.dy),
      scale: round(chartFit.scale),
      rotation_deg: round(chartFit.rotation_deg),
    }
    const metaPayload = {
      ...meta,
      chart_fit: chartFitPayload,
    }
    const layoutPayload = {
      overrides: Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [
          key,
          normalizeOverride(value),
        ])
      ),
      frame_circle: frameCircle ?? undefined,
      design,
      chart_fit: chartFitPayload,
      chart_occluders: chartOccluders,
    }
    const metaResponse = await apiFetchWithAuth(
      `${apiBase}/api/charts/${chartId}/frames/${selectedId}/metadata`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPayload),
      }
    )
    if (!metaResponse.ok) {
      const detail = await readApiError(metaResponse)
      setError(detail ?? 'Failed to save metadata.')
      setStatus('')
      return
    }
    const layoutResponse = await apiFetchWithAuth(
      `${apiBase}/api/charts/${chartId}/frames/${selectedId}/layout`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layoutPayload),
      }
    )
    if (!layoutResponse.ok) {
      const detail = await readApiError(layoutResponse)
      setError(detail ?? 'Failed to save layout.')
      setStatus('')
      return
    }
    dispatch({ type: 'SET_SAVED_FIT', fit: chartFit })
    dispatch({ type: 'MARK_SYNCED', version: clientVersion, savedAt: Date.now() })
    setError('')
    setStatus('Saved metadata and layout.')
  }

  return { saveAll }
}
