import { apiFetch, readApiError } from '../api/client'
import { buildChartFitPayload, buildLayoutPayload } from '../utils/layout'
import type { ChartFit, ChartMeta, DesignSettings, FrameCircle, Offset } from '../types'
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
  frameMaskCutoff: number
  frameMaskOffwhiteBoost: number
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
    frameMaskCutoff,
    frameMaskOffwhiteBoost,
    clientVersion,
    setError,
    setStatus,
    dispatch,
  } = params

  const apiFetchWithAuth = (url: string, init: RequestInit = {}) => apiFetch(url, jwt, init)

  const saveAll = async () => {
    try {
      if (!jwt) {
        setError('Login required to save changes.')
        return
      }
      if (!chartId) {
        setError('Chart ID is required to save changes.')
        return
      }
      if (isChartOnly) {
        const chartFitPayload = buildChartFitPayload(chartFit)
      const layoutPayload = buildLayoutPayload({
        overrides,
        design,
        frameMaskCutoff,
        frameMaskOffwhiteBoost,
      })
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
      const chartFitPayload = buildChartFitPayload(chartFit)
      const metaPayload = {
        ...meta,
        chart_fit: chartFitPayload,
      }
    const layoutPayload = buildLayoutPayload({
      overrides,
      frameCircle,
      design,
      chartFit,
      frameMaskCutoff,
      frameMaskOffwhiteBoost,
    })
      const documentResponse = await apiFetchWithAuth(
        `${apiBase}/api/charts/${chartId}/frames/${selectedId}/document`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            layout: layoutPayload,
            metadata: metaPayload,
          }),
        }
      )
      if (!documentResponse.ok) {
        const detail = await readApiError(documentResponse)
        setError(detail ?? 'Failed to save editor document.')
        setStatus('')
        return
      }
      dispatch({ type: 'SET_SAVED_FIT', fit: chartFit })
      dispatch({ type: 'MARK_SYNCED', version: clientVersion, savedAt: Date.now() })
      setError('')
      setStatus('Saved editor document.')
    } catch (err) {
      setError(`Failed to save changes: ${String(err)}`)
      setStatus('')
    }
  }

  return { saveAll }
}
