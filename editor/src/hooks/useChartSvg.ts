import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchJsonAuth, fetchJsonIfOkAuth, fetchTextIfOkAuth } from '../api/client'
import { extractChartInner, stripOverrideTransforms } from '../utils/svg'
import type {
  ChartFit,
  ChartMeta,
  DesignSettings,
  FrameCircle,
  FrameDetail,
  LayoutFile,
  Offset,
} from '../types'

type LayoutLoadResult = {
  fit: ChartFit
  overrides: Record<string, Offset>
  frameCircle: FrameCircle | null
  design: DesignSettings
}

type UseChartSvgParams = {
  apiBase: string
  jwt: string
  chartId: string
  selectedId: string
  isChartOnly: boolean
  designPreview: DesignSettings
  defaultDesign: DesignSettings
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
    designPreview,
    defaultDesign,
    onLayoutLoaded,
  } = params
  const [meta, setMeta] = useState<ChartMeta | null>(null)
  const [selectedFrameDetail, setSelectedFrameDetail] = useState<FrameDetail | null>(null)
  const [chartSvgBase, setChartSvgBase] = useState('')
  const [hasSavedFit, setHasSavedFit] = useState(false)
  const [layoutReady, setLayoutReady] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const onLayoutLoadedRef = useRef(onLayoutLoaded)
  const lastLayoutKeyRef = useRef('')
  const layoutOverridesRef = useRef<Record<string, Offset>>({})

  const fetchJsonAuthWith = useCallback((url: string) => fetchJsonAuth(url, jwt), [jwt])
  const fetchJsonIfOkAuthWith = useCallback((url: string) => fetchJsonIfOkAuth(url, jwt), [jwt])
  const fetchTextIfOkAuthWith = useCallback((url: string) => fetchTextIfOkAuth(url, jwt), [jwt])

  useEffect(() => {
    onLayoutLoadedRef.current = onLayoutLoaded
  }, [onLayoutLoaded])

  const normalizeDesign = useCallback((design?: Partial<DesignSettings> | null) => {
    const requiredLayers: Array<DesignSettings['layer_order'][number]> = [
      'background',
      'frame',
      'chart',
    ]
    const baseOrder = design?.layer_order ?? defaultDesign.layer_order
    const seen = new Set<string>()
    const deduped = baseOrder.filter((layer) => {
      if (seen.has(layer)) {
        return false
      }
      seen.add(layer)
      return true
    })
    const defaultOrder = defaultDesign.layer_order
    const withRequired = [...deduped]
    requiredLayers.forEach((layer) => {
      if (withRequired.includes(layer)) {
        return
      }
      const defaultIndex = defaultOrder.indexOf(layer)
      if (defaultIndex >= 0) {
        const nextIndex = withRequired.findIndex((value) => {
          const valueIndex = defaultOrder.indexOf(value)
          return valueIndex >= 0 && valueIndex > defaultIndex
        })
        if (nextIndex >= 0) {
          withRequired.splice(nextIndex, 0, layer)
          return
        }
      }
      withRequired.push(layer)
    })

    const backgroundImagePath =
      design?.background_image_path ?? defaultDesign.background_image_path
    let nextLayerOrder = withRequired
    if (backgroundImagePath && !nextLayerOrder.includes('chart_background_image')) {
      const chartIndex = nextLayerOrder.indexOf('chart')
      nextLayerOrder =
        chartIndex >= 0
          ? [
              ...nextLayerOrder.slice(0, chartIndex),
              'chart_background_image',
              ...nextLayerOrder.slice(chartIndex),
            ]
          : [...nextLayerOrder, 'chart_background_image']
    }
    return {
      layer_order: nextLayerOrder,
      layer_opacity: design?.layer_opacity ?? defaultDesign.layer_opacity,
      background_image_path: backgroundImagePath,
      background_image_scale:
        design?.background_image_scale ?? defaultDesign.background_image_scale,
      background_image_dx: design?.background_image_dx ?? defaultDesign.background_image_dx,
      background_image_dy: design?.background_image_dy ?? defaultDesign.background_image_dy,
      sign_glyph_scale: design?.sign_glyph_scale ?? defaultDesign.sign_glyph_scale,
      planet_glyph_scale: design?.planet_glyph_scale ?? defaultDesign.planet_glyph_scale,
      inner_ring_scale: design?.inner_ring_scale ?? defaultDesign.inner_ring_scale,
    }
  }, [defaultDesign])

  const buildDesignParams = useCallback((design: DesignSettings) => {
    const requiredLayers: Array<DesignSettings['layer_order'][number]> = [
      'background',
      'frame',
      'chart',
    ]
    const layerOrder = requiredLayers.every((layer) => design.layer_order.includes(layer))
      ? design.layer_order
      : defaultDesign.layer_order
    const params = new URLSearchParams()
    params.set('design_layer_order', layerOrder.join(','))
    params.set('design_sign_glyph_scale', design.sign_glyph_scale.toString())
    params.set('design_planet_glyph_scale', design.planet_glyph_scale.toString())
    params.set('design_inner_ring_scale', design.inner_ring_scale.toString())
    params.set('design_background_image_scale', design.background_image_scale.toString())
    params.set('design_background_image_dx', design.background_image_dx.toString())
    params.set('design_background_image_dy', design.background_image_dy.toString())
    return params
  }, [defaultDesign])

  useEffect(() => {
    queueMicrotask(() => {
      setLayoutReady(false)
    })
    if (!selectedId) {
      queueMicrotask(() => {
        setSelectedFrameDetail(null)
        setMeta(null)
        setChartSvgBase('')
        setHasSavedFit(false)
        layoutOverridesRef.current = {}
        setLayoutReady(false)
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
          setLayoutReady(false)
        })
        return
      }
      const chartMetaUrl = `${apiBase}/api/charts/${chartId}/chart_only/meta`
      const layoutUrl = `${apiBase}/api/charts/${chartId}/layout`
      Promise.all([
        fetchJsonAuthWith(chartMetaUrl),
        fetchJsonIfOkAuthWith(layoutUrl),
      ])
        .then(([chartMeta, layoutData]) => {
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
          const design = normalizeDesign((layoutData as LayoutFile | null)?.design)
          const layoutKey = JSON.stringify({ fit, overrides: nextOverrides, frameCircle })
          if (lastLayoutKeyRef.current !== layoutKey) {
            lastLayoutKeyRef.current = layoutKey
            layoutOverridesRef.current = nextOverrides
            onLayoutLoadedRef.current({ fit, overrides: nextOverrides, frameCircle, design })
          }
          setLayoutReady(true)
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
    Promise.all([
      fetchJsonAuthWith(frameDetailUrl),
      chartMetaUrl ? fetchJsonIfOkAuthWith(chartMetaUrl) : Promise.resolve(null),
      layoutUrl ? fetchJsonIfOkAuthWith(layoutUrl) : Promise.resolve({ overrides: {} }),
    ])
      .then(([frameDetail, chartMeta, layoutData]) => {
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
        const design = normalizeDesign((layoutData as LayoutFile | null)?.design)
        const layoutKey = JSON.stringify({ fit, overrides: nextOverrides, frameCircle })
        if (lastLayoutKeyRef.current !== layoutKey) {
          lastLayoutKeyRef.current = layoutKey
          layoutOverridesRef.current = nextOverrides
          onLayoutLoadedRef.current({ fit, overrides: nextOverrides, frameCircle, design })
        }
        setLayoutReady(true)
      })
      .catch((err) => setError(String(err)))
  }, [
    apiBase,
    chartId,
    fetchJsonAuthWith,
    fetchJsonIfOkAuthWith,
    isChartOnly,
    jwt,
    normalizeDesign,
    selectedId,
  ])

  useEffect(() => {
    if (!layoutReady) {
      return
    }
    if (!chartId) {
      queueMicrotask(() => {
        setChartSvgBase('')
      })
      return
    }
    if (!selectedId) {
      queueMicrotask(() => {
        setChartSvgBase('')
      })
      return
    }
    const params = buildDesignParams(normalizeDesign(designPreview))
    if (isChartOnly) {
      const svgUrl = `${apiBase}/api/charts/${chartId}/render_chart.svg?${params.toString()}`
      fetchTextIfOkAuthWith(svgUrl)
        .then((svgText) => {
          const inner = svgText ? extractChartInner(svgText as string) : ''
          setChartSvgBase(stripOverrideTransforms(inner, layoutOverridesRef.current))
        })
        .catch((err) => setError(String(err)))
      return
    }
    const frameParams = new URLSearchParams(params)
    frameParams.set('frame_id', selectedId)
    const svgUrl = `${apiBase}/api/charts/${chartId}/render.svg?${frameParams.toString()}`
    fetchTextIfOkAuthWith(svgUrl)
      .then((svgText) => {
        const inner = svgText ? extractChartInner(svgText as string) : ''
        setChartSvgBase(stripOverrideTransforms(inner, layoutOverridesRef.current))
      })
      .catch((err) => setError(String(err)))
  }, [
    apiBase,
    buildDesignParams,
    chartId,
    designPreview,
    fetchTextIfOkAuthWith,
    isChartOnly,
    layoutReady,
    normalizeDesign,
    selectedId,
  ])

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
