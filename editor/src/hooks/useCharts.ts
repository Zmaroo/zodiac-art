import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChartDetail, ChartListItem } from '../types'
import { apiFetch, readApiError } from '../api/client'

type UseChartsParams = {
  apiBase: string
  jwt: string
  selectedId: string
  setSelectedId: (value: string) => void
  setBirthDate: (value: string) => void
  setBirthTime: (value: string) => void
  setLatitude: (value: number) => void
  setLongitude: (value: number) => void
}

type UseChartsResult = {
  charts: ChartListItem[]
  chartId: string
  setChartId: (value: string) => void
  chartName: string
  setChartName: (value: string) => void
  loadCharts: () => void
  createChart: (payload: {
    birthDate: string
    birthTime: string
    latitude: number
    longitude: number
  }) => Promise<void>
  selectChart: (chartIdToLoad: string) => Promise<void>
  error: string
  status: string
  clearStatus: () => void
  clearError: () => void
}

export function useCharts(params: UseChartsParams): UseChartsResult {
  const {
    apiBase,
    jwt,
    selectedId,
    setSelectedId,
    setBirthDate,
    setBirthTime,
    setLatitude,
    setLongitude,
  } = params
  const [charts, setCharts] = useState<ChartListItem[]>([])
  const [chartId, setChartId] = useState<string>(
    () => localStorage.getItem('zodiac_editor.chartId') ?? ''
  )
  const [chartName, setChartName] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const lastLoadedChartIdRef = useRef('')

  const apiFetchWithAuth = useCallback(
    (url: string, init: RequestInit = {}) => apiFetch(url, jwt, init),
    [jwt]
  )

  const loadCharts = useCallback(() => {
    if (!jwt) {
      setCharts([])
      return
    }
    apiFetchWithAuth(`${apiBase}/api/charts`)
      .then((response) => response.json())
      .then((data: ChartListItem[]) => setCharts(data))
      .catch((err) => setError(String(err)))
  }, [apiBase, apiFetchWithAuth, jwt])

  useEffect(() => {
    queueMicrotask(() => {
      loadCharts()
    })
  }, [loadCharts])

  useEffect(() => {
    localStorage.setItem('zodiac_editor.chartId', chartId)
  }, [chartId])

  const createChart = async (payload: {
    birthDate: string
    birthTime: string
    latitude: number
    longitude: number
  }) => {
    if (!jwt) {
      setError('Login required to create charts.')
      return
    }
    if (!selectedId) {
      setError('Select a frame before creating a chart.')
      return
    }
    const response = await apiFetchWithAuth(`${apiBase}/api/charts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: chartName.trim() || undefined,
        birth_date: payload.birthDate,
        birth_time: payload.birthTime,
        latitude: payload.latitude,
        longitude: payload.longitude,
        default_frame_id: selectedId === '__chart_only__' ? undefined : selectedId,
      }),
    })
    if (!response.ok) {
      setError('Failed to create chart.')
      setStatus('')
      return
    }
    const data = (await response.json()) as { chart_id: string }
    setChartId(data.chart_id)
    setError('')
    setStatus(`Created chart ${data.chart_id}`)
    loadCharts()
  }

  const selectChart = useCallback(
    async (chartIdToLoad: string) => {
      if (!jwt) {
        setError('Login required to load charts.')
        return
      }
      lastLoadedChartIdRef.current = chartIdToLoad
      setError('')
      const response = await apiFetchWithAuth(`${apiBase}/api/charts/${chartIdToLoad}`)
      if (!response.ok) {
        const detail = await readApiError(response)
        setError(detail ?? 'Failed to load chart.')
        return
      }
      const data = (await response.json()) as ChartDetail
      setChartId(data.chart_id)
      setBirthDate(data.birth_date)
      setBirthTime(data.birth_time)
      setLatitude(data.latitude)
      setLongitude(data.longitude)
      setChartName(data.name ?? '')
      if (data.default_frame_id) {
        setSelectedId(data.default_frame_id)
      } else {
        setSelectedId('__chart_only__')
      }
    },
    [apiBase, apiFetchWithAuth, jwt, setBirthDate, setBirthTime, setLatitude, setLongitude, setSelectedId]
  )

  useEffect(() => {
    if (!jwt || !chartId) {
      return
    }
    if (lastLoadedChartIdRef.current === chartId) {
      return
    }
    lastLoadedChartIdRef.current = chartId
    queueMicrotask(() => {
      selectChart(chartId).catch(() => undefined)
    })
  }, [chartId, jwt, selectChart])

  const clearStatus = () => {
    setStatus('')
  }

  const clearError = () => {
    setError('')
  }

  return {
    charts,
    chartId,
    setChartId,
    chartName,
    setChartName,
    loadCharts,
    createChart,
    selectChart,
    error,
    status,
    clearStatus,
    clearError,
  }
}
