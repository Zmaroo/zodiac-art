import { apiFetch, readApiError } from '../api/client'
import { normalizeOverride, round } from '../utils/format'
import type { ChartFit, ChartMeta, FrameCircle, Offset } from '../types'
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
  frameCircle: FrameCircle | null
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
    frameCircle,
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
      setError('')
      setStatus('Saved chart-only layout.')
      return
    }
    if (!meta || !selectedId) {
      return
    }
    const metaPayload = {
      ...meta,
      chart_fit: {
        dx: round(chartFit.dx),
        dy: round(chartFit.dy),
        scale: round(chartFit.scale),
        rotation_deg: round(chartFit.rotation_deg),
      },
    }
    const layoutPayload = {
      overrides: Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [
          key,
          normalizeOverride(value),
        ])
      ),
      frame_circle: frameCircle ?? undefined,
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
    setError('')
    setStatus('Saved metadata and layout.')
  }

  const autoFix = async () => {
    if (!jwt) {
      setError('Login required for auto-fix.')
      return
    }
    if (!chartId) {
      setError('Chart ID is required for auto-fix.')
      return
    }
    if (!isChartOnly && !selectedId) {
      setError('Select a frame before auto-fix.')
      return
    }
    const endpoint = isChartOnly
      ? `${apiBase}/api/charts/${chartId}/auto_layout`
      : `${apiBase}/api/charts/${chartId}/frames/${selectedId}/auto_layout`
    const response = await apiFetchWithAuth(
      endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'glyphs', min_gap_px: 10, max_iter: 240 }),
      }
    )
    if (!response.ok) {
      setError('Failed to auto-fix overlaps.')
      setStatus('')
      return
    }
    const data = (await response.json()) as { overrides: Record<string, Offset> }
    dispatch({ type: 'SET_OVERRIDES', overrides: { ...overrides, ...data.overrides } })
    setError('')
    setStatus('Auto-fix applied.')
  }

  return { saveAll, autoFix }
}
