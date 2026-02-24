import { useEffect, useMemo, useState } from 'react'
import { apiFetch, readApiError } from '../api/client'
import type { DesignSettings } from '../types'

type UseBackgroundImageParams = {
  apiBase: string
  jwt: string
  chartId: string
  design: DesignSettings
  updateDesign: (next: Partial<DesignSettings>) => void
  lastSavedAt?: number | null
  lastSyncedAt?: number | null
}

type UseBackgroundImageResult = {
  backgroundImageUrl: string
  backgroundImageError: string
  backgroundImageStatus: string
  backgroundImageUploading: boolean
  handleBackgroundImageUpload: (file: File | null) => Promise<void>
  handleBackgroundImageClear: () => Promise<void>
}

export function useBackgroundImage(params: UseBackgroundImageParams): UseBackgroundImageResult {
  const { apiBase, jwt, chartId, design, updateDesign, lastSavedAt, lastSyncedAt } = params
  const [backgroundImageError, setBackgroundImageError] = useState('')
  const [backgroundImageStatus, setBackgroundImageStatus] = useState('')
  const [backgroundImageUploading, setBackgroundImageUploading] = useState(false)
  const [backgroundImageVersion, setBackgroundImageVersion] = useState(0)

  const backgroundImageUrl = useMemo(() => {
    if (!design.background_image_path) {
      return ''
    }
    const cleaned = design.background_image_path.replace(/^\/+/, '')
    const version = backgroundImageVersion || lastSavedAt || lastSyncedAt || 0
    const suffix = version ? `?v=${version}` : ''
    return `${apiBase}/static/storage/${cleaned}${suffix}`
  }, [apiBase, backgroundImageVersion, design.background_image_path, lastSavedAt, lastSyncedAt])

  useEffect(() => {
    if (!design.background_image_path) {
      setBackgroundImageVersion(0)
      return
    }
    setBackgroundImageVersion((current) => (current ? current : Date.now()))
  }, [design.background_image_path])

  const handleBackgroundImageUpload = async (file: File | null) => {
    if (!file) {
      return
    }
    if (!jwt) {
      setBackgroundImageError('Login required to upload background images.')
      setBackgroundImageStatus('')
      return
    }
    if (!chartId) {
      setBackgroundImageError('Chart ID is required to upload a background image.')
      setBackgroundImageStatus('')
      return
    }
    setBackgroundImageUploading(true)
    setBackgroundImageError('')
    setBackgroundImageStatus('Uploading background image...')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await apiFetch(`${apiBase}/api/charts/${chartId}/design/background_image`, jwt, {
        method: 'POST',
        body: formData,
      })
      if (!response.ok) {
        const detail = await readApiError(response)
        setBackgroundImageError(detail ?? 'Failed to upload background image.')
        setBackgroundImageStatus('')
        return
      }
      const data = (await response.json()) as { path: string }
      updateDesign({
        background_image_path: data.path,
        background_image_scale: 1,
        background_image_dx: 0,
        background_image_dy: 0,
      })
      setBackgroundImageVersion(Date.now())
      setBackgroundImageStatus('Background image uploaded.')
    } finally {
      setBackgroundImageUploading(false)
    }
  }

  const handleBackgroundImageClear = async () => {
    const previous = {
      path: design.background_image_path ?? null,
      scale: design.background_image_scale,
      dx: design.background_image_dx,
      dy: design.background_image_dy,
    }
    updateDesign({
      background_image_path: null,
      background_image_scale: 1,
      background_image_dx: 0,
      background_image_dy: 0,
    })
    if (!jwt || !chartId) {
      return
    }
    setBackgroundImageError('')
    setBackgroundImageStatus('Removing background image...')
    const response = await apiFetch(`${apiBase}/api/charts/${chartId}/design/background_image`, jwt, {
      method: 'DELETE',
    })
    if (!response.ok) {
      const detail = await readApiError(response)
      setBackgroundImageError(detail ?? 'Failed to remove background image.')
      setBackgroundImageStatus('')
      updateDesign({
        background_image_path: previous.path,
        background_image_scale: previous.scale,
        background_image_dx: previous.dx,
        background_image_dy: previous.dy,
      })
      return
    }
    setBackgroundImageStatus('Background image removed.')
  }

  return {
    backgroundImageUrl,
    backgroundImageError,
    backgroundImageStatus,
    backgroundImageUploading,
    handleBackgroundImageUpload,
    handleBackgroundImageClear,
  }
}
