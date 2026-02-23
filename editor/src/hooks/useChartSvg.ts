import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchJsonAuth, fetchJsonIfOkAuth, fetchTextIfOkAuth } from '../api/client'
import { extractChartInner, stripOverrideTransforms } from '../utils/svg'
import type { ChartFit, ChartMeta, FrameCircle, FrameDetail, LayoutFile, Offset } from '../types'

type LayoutLoadResult = {
  fit: ChartFit
  overrides: Record<string, Offset>
  frameCircle: FrameCircle | null
}

type UseChartSvgParams = {
  apiBase: string
  jwt: string
  chartId: string
  selectedId: string
  isChartOnly: boolean
  onLayoutLoaded: (result: LayoutLoadResult) => void
}

type UseChartSvgResult = {
  meta: ChartMeta | null
  selectedFrameDetail: FrameDetail | null
  chartSvgBase: string
  hasSavedFit: boolean
  error: string
  status: string
  clearStatus: () => void
}

export function useChartSvg(params: UseChartSvgParams): UseChartSvgResult {
  const {
    apiBase,
    jwt,
    chartId,
    selectedId,
    isChartOnly,
    onLayoutLoaded,
  } = params
  const [meta, setMeta] = useState<ChartMeta | null>(null)
  const [selectedFrameDetail, setSelectedFrameDetail] = useState<FrameDetail | null>(null)
  const [chartSvgBase, setChartSvgBase] = useState('')
  const [hasSavedFit, setHasSavedFit] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const onLayoutLoadedRef = useRef(onLayoutLoaded)
  const lastLayoutKeyRef = useRef('')

  const fetchJsonAuthWith = useCallback((url: string) => fetchJsonAuth(url, jwt), [jwt])
  const fetchJsonIfOkAuthWith = useCallback((url: string) => fetchJsonIfOkAuth(url, jwt), [jwt])
  const fetchTextIfOkAuthWith = useCallback((url: string) => fetchTextIfOkAuth(url, jwt), [jwt])

  useEffect(() => {
    onLayoutLoadedRef.current = onLayoutLoaded
  }, [onLayoutLoaded])

  useEffect(() => {
    if (!selectedId) {
      queueMicrotask(() => {
        setSelectedFrameDetail(null)
        setMeta(null)
        setChartSvgBase('')
        setHasSavedFit(false)
      })
      return
    }
    queueMicrotask(() => {
      setError('')
      setStatus('')
    })
    if (isChartOnly) {
      if (!chartId) {
        queueMicrotask(() => {
          setSelectedFrameDetail(null)
          setMeta(null)
          setChartSvgBase('')
        })
        return
      }
      const chartMetaUrl = `${apiBase}/api/charts/${chartId}/chart_only/meta`
      const layoutUrl = `${apiBase}/api/charts/${chartId}/layout`
      const svgUrl = `${apiBase}/api/charts/${chartId}/render_chart.svg`
      Promise.all([
        fetchJsonAuthWith(chartMetaUrl),
        fetchJsonIfOkAuthWith(layoutUrl),
        fetchTextIfOkAuthWith(svgUrl),
      ])
        .then(([chartMeta, layoutData, svgText]) => {
          setSelectedFrameDetail(null)
          const metaData = chartMeta as ChartMeta
          setMeta(metaData)
          setHasSavedFit(Boolean(metaData?.chart_fit))
          const fit = {
            dx: metaData.chart_fit?.dx ?? 0,
            dy: metaData.chart_fit?.dy ?? 0,
            scale: metaData.chart_fit?.scale ?? 1,
            rotation_deg: metaData.chart_fit?.rotation_deg ?? 0,
          }
          const nextOverrides = (layoutData as LayoutFile | null)?.overrides || {}
          const frameCircle = (layoutData as LayoutFile | null)?.frame_circle ?? null
          const layoutKey = JSON.stringify({ fit, overrides: nextOverrides, frameCircle })
          if (lastLayoutKeyRef.current !== layoutKey) {
            lastLayoutKeyRef.current = layoutKey
            onLayoutLoadedRef.current({ fit, overrides: nextOverrides, frameCircle })
          }
          const inner = svgText ? extractChartInner(svgText as string) : ''
          setChartSvgBase(stripOverrideTransforms(inner, nextOverrides))
        })
        .catch((err) => setError(String(err)))
      return
    }

    const frameDetailUrl = `${apiBase}/api/frames/${selectedId}`
    const chartMetaUrl = chartId
      ? `${apiBase}/api/charts/${chartId}/frames/${selectedId}/metadata`
      : null
    const layoutUrl = chartId
      ? `${apiBase}/api/charts/${chartId}/frames/${selectedId}/layout`
      : null
    const svgUrl = chartId
      ? `${apiBase}/api/charts/${chartId}/render.svg?${new URLSearchParams({
          frame_id: selectedId,
        }).toString()}`
      : null

    Promise.all([
      fetchJsonAuthWith(frameDetailUrl),
      chartMetaUrl ? fetchJsonIfOkAuthWith(chartMetaUrl) : Promise.resolve(null),
      layoutUrl ? fetchJsonIfOkAuthWith(layoutUrl) : Promise.resolve({ overrides: {} }),
      svgUrl ? fetchTextIfOkAuthWith(svgUrl) : Promise.resolve(''),
    ])
      .then(([frameDetail, chartMeta, layoutData, svgText]) => {
        const detail = frameDetail as FrameDetail
        setSelectedFrameDetail(detail)
        const templateMeta = detail.template_metadata_json
        const chartMetaData = chartMeta as ChartMeta | null
        const metaData = chartMetaData || (templateMeta as ChartMeta)
        setMeta(metaData)
        setHasSavedFit(Boolean(chartMetaData?.chart_fit))
        const fit = {
          dx: metaData.chart_fit?.dx ?? 0,
          dy: metaData.chart_fit?.dy ?? 0,
          scale: metaData.chart_fit?.scale ?? 1,
          rotation_deg: metaData.chart_fit?.rotation_deg ?? 0,
        }
        const nextOverrides = (layoutData as LayoutFile | null)?.overrides || {}
        const frameCircle = (layoutData as LayoutFile | null)?.frame_circle ?? null
        const layoutKey = JSON.stringify({ fit, overrides: nextOverrides, frameCircle })
        if (lastLayoutKeyRef.current !== layoutKey) {
          lastLayoutKeyRef.current = layoutKey
          onLayoutLoadedRef.current({ fit, overrides: nextOverrides, frameCircle })
        }
        const inner = svgText ? extractChartInner(svgText as string) : ''
        setChartSvgBase(stripOverrideTransforms(inner, nextOverrides))
      })
      .catch((err) => setError(String(err)))
  }, [apiBase, chartId, fetchJsonAuthWith, fetchJsonIfOkAuthWith, fetchTextIfOkAuthWith, isChartOnly, jwt, selectedId])

  const clearStatus = () => {
    setStatus('')
  }

  return {
    meta,
    selectedFrameDetail,
    chartSvgBase,
    hasSavedFit,
    error,
    status,
    clearStatus,
  }
}
