import { useEffect, useRef, useState } from 'react'
import { apiFetch } from '../api/client'
import { detectInnerCircleFromImage } from '../lib/frameCircleDetect'
import { normalizeOverride } from '../utils/format'
import type { FrameCircle, FrameDetail, Offset } from '../types'

type UseFrameCircleParams = {
  apiBase: string
  jwt: string
  chartId: string
  selectedId: string
  isChartOnly: boolean
  selectedFrameDetail: FrameDetail | null
  overrides: Record<string, Offset>
}

type UseFrameCircleResult = {
  frameCircle: FrameCircle | null
  setFrameCircle: (circle: FrameCircle | null) => void
  error: string
  status: string
  clearStatus: () => void
}

export function useFrameCircle(params: UseFrameCircleParams): UseFrameCircleResult {
  const { apiBase, jwt, chartId, selectedId, isChartOnly, selectedFrameDetail, overrides } = params
  const [frameCircle, setFrameCircle] = useState<FrameCircle | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const saveKeyRef = useRef<string>('')

  const apiFetchWithAuth = (url: string, init: RequestInit = {}) => apiFetch(url, jwt, init)

  useEffect(() => {
    if (!selectedFrameDetail) {
      setFrameCircle(null)
      return
    }
    const frameUrl = `${apiBase}${selectedFrameDetail.image_url}`
    let cancelled = false
    detectInnerCircleFromImage(frameUrl)
      .then((circle) => {
        if (!cancelled) {
          setFrameCircle(circle)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err))
          setFrameCircle(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [apiBase, selectedFrameDetail])

  useEffect(() => {
    if (!frameCircle || !selectedFrameDetail) {
      return
    }
    if (!jwt || !chartId || !selectedId || isChartOnly) {
      return
    }
    const key = `${selectedFrameDetail.id}:${frameCircle.cxNorm.toFixed(4)}:${frameCircle.cyNorm.toFixed(4)}:${frameCircle.rNorm.toFixed(4)}`
    if (saveKeyRef.current === key) {
      return
    }
    saveKeyRef.current = key
    const layoutPayload = {
      overrides: Object.fromEntries(
        Object.entries(overrides).map(([entryKey, value]) => [
          entryKey,
          normalizeOverride(value),
        ])
      ),
      frame_circle: frameCircle,
    }
    apiFetchWithAuth(`${apiBase}/api/charts/${chartId}/frames/${selectedId}/layout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layoutPayload),
    })
      .then((response) => {
        if (!response.ok) {
          setError('Failed to save frame circle.')
          return
        }
        setStatus('Frame circle saved.')
      })
      .catch((err) => setError(String(err)))
  }, [apiBase, chartId, frameCircle, isChartOnly, jwt, overrides, selectedFrameDetail, selectedId])

  const clearStatus = () => {
    setStatus('')
  }

  return { frameCircle, setFrameCircle, error, status, clearStatus }
}
