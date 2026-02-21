import { useState } from 'react'
import { apiFetch, readApiError } from '../api/client'
import type { FrameDetail } from '../types'

type UseExportParams = {
  apiBase: string
  jwt: string
  chartId: string
  chartName: string
  selectedId: string
  isChartOnly: boolean
  glyphGlow: boolean
  glyphOutlineEnabled: boolean
  glyphOutlineColor: string
  selectedFrameDetail: FrameDetail | null
  setError: (value: string) => void
  setStatus: (value: string) => void
  clearActionsMessages: () => void
}

export function useExport(params: UseExportParams) {
  const {
    apiBase,
    jwt,
    chartId,
    chartName,
    selectedId,
    isChartOnly,
    glyphGlow,
    glyphOutlineEnabled,
    glyphOutlineColor,
    selectedFrameDetail,
    setError,
    setStatus,
    clearActionsMessages,
  } = params
  const [exportFormat, setExportFormat] = useState<'png' | 'svg'>('png')

  const sanitizeFileName = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const exportEnabled = Boolean(chartId && (isChartOnly || selectedId))
  const exportDisabledTitle = exportEnabled
    ? ''
    : 'Select a chart and frame to export, or choose chart-only.'

  const handleExport = async () => {
    clearActionsMessages()
    if (!chartId) {
      setError('Select a chart before exporting.')
      return
    }
    if (!isChartOnly && !selectedId) {
      setError('Export requires a frame selection.')
      return
    }
    const params = new URLSearchParams()
    if (!isChartOnly) {
      params.set('frame_id', selectedId)
    }
    if (glyphGlow) {
      params.set('glyph_glow', '1')
    }
    if (glyphOutlineEnabled && glyphOutlineColor) {
      params.set('glyph_outline_color', glyphOutlineColor)
    }
    const endpoint = isChartOnly
      ? `render_export_chart.${exportFormat}`
      : `render_export.${exportFormat}`
    const query = params.toString()
    const url = query
      ? `${apiBase}/api/charts/${chartId}/${endpoint}?${query}`
      : `${apiBase}/api/charts/${chartId}/${endpoint}`
    try {
      const response = await apiFetch(url, jwt)
      if (!response.ok) {
        const message = await readApiError(response)
        throw new Error(message || `Failed to export ${exportFormat.toUpperCase()}.`)
      }
      const blob = await response.blob()
      const parts = [chartName?.trim() || `chart-${chartId}`, selectedFrameDetail?.name]
      const baseName = sanitizeFileName(parts.filter(Boolean).join('-')) || `chart-${chartId}`
      const filename = `${baseName}.${exportFormat}`
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(objectUrl)
      setStatus(`Exported ${exportFormat.toUpperCase()}.`)
    } catch (err) {
      setError(String(err))
    }
  }

  return {
    exportFormat,
    setExportFormat,
    exportEnabled,
    exportDisabledTitle,
    handleExport,
  }
}
