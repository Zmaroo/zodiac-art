import { useCallback, useEffect, useRef, useState } from 'react'
import { detectInnerCircleFromImage, detectMaskEllipseFromImage } from '../lib/frameCircleDetect'
import type { FrameCircle, FrameDetail } from '../types'

type UseFrameCircleParams = {
  apiBase: string
  selectedFrameDetail: FrameDetail | null
  frameCircleLocked: boolean
}

type UseFrameCircleResult = {
  frameCircle: FrameCircle | null
  setFrameCircle: (circle: FrameCircle | null) => void
  setFrameCircleFromUser: (circle: FrameCircle | null) => void
  resetFrameCircleAuto: () => void
  error: string
  status: string
  clearStatus: () => void
  snapFrameMask: (whiteCutoff: number, offwhiteBoost: number) => void
}

export function useFrameCircle(params: UseFrameCircleParams): UseFrameCircleResult {
  const {
    apiBase,
    selectedFrameDetail,
    frameCircleLocked,
  } = params
  const [frameCircle, setFrameCircle] = useState<FrameCircle | null>(null)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const lastFrameIdRef = useRef<string>('')
  const userChangeRef = useRef(false)
  const userClearedRef = useRef(false)

  useEffect(() => {
    if (!frameCircleLocked) {
      return
    }
    userClearedRef.current = true
    userChangeRef.current = true
    setFrameCircle(null)
  }, [frameCircleLocked])

  const setFrameCircleFromUser = useCallback((circle: FrameCircle | null) => {
    userChangeRef.current = true
    userClearedRef.current = circle === null
    setFrameCircle(circle)
  }, [])

  const resetFrameCircleAuto = useCallback(() => {
    userClearedRef.current = false
    userChangeRef.current = false
    setFrameCircle(null)
  }, [])

  useEffect(() => {
    const frameId = selectedFrameDetail?.id ?? ''
    if (frameId && frameId !== lastFrameIdRef.current) {
      lastFrameIdRef.current = frameId
      userChangeRef.current = false
      userClearedRef.current = false
      queueMicrotask(() => {
        setFrameCircle(null)
      })
      return
    }
    if (!selectedFrameDetail) {
      userClearedRef.current = false
      queueMicrotask(() => {
        setFrameCircle(null)
      })
      return
    }
    if (frameCircleLocked) {
      return
    }
    if (userClearedRef.current) {
      return
    }
    if (frameCircle) {
      return
    }
    const meta = selectedFrameDetail.template_metadata_json
    if (meta?.canvas?.width && meta?.canvas?.height && meta?.chart?.ring_outer) {
      const cx = meta.chart.center?.x ?? meta.canvas.width / 2
      const cy = meta.chart.center?.y ?? meta.canvas.height / 2
      const rNorm = meta.chart.ring_outer / meta.canvas.width
      const circle: FrameCircle = {
        cxNorm: cx / meta.canvas.width,
        cyNorm: cy / meta.canvas.height,
        rNorm,
        rxNorm: rNorm,
        ryNorm: meta.chart.ring_outer / meta.canvas.height,
      }
      queueMicrotask(() => {
        setFrameCircle(circle)
      })
      return
    }
    const frameUrl = `${apiBase}${selectedFrameDetail.image_url}`
    let cancelled = false
    detectInnerCircleFromImage(frameUrl)
      .then((circle) => {
        if (!cancelled && !userClearedRef.current) {
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
  }, [apiBase, frameCircle, selectedFrameDetail])

  const snapFrameMask = useCallback(
    (whiteCutoff: number, offwhiteBoost: number) => {
      if (!selectedFrameDetail) {
        return
      }
      const frameUrl = `${apiBase}${selectedFrameDetail.image_url}`
      const centerOverride = frameCircle
        ? { cxNorm: frameCircle.cxNorm, cyNorm: frameCircle.cyNorm }
        : undefined
      detectMaskEllipseFromImage(frameUrl, whiteCutoff, offwhiteBoost, centerOverride)
        .then((circle) => {
          userChangeRef.current = true
          userClearedRef.current = false
          setFrameCircle(circle)
          setError('')
        })
        .catch((err) => setError(String(err)))
    },
    [apiBase, frameCircle, selectedFrameDetail]
  )

  const clearStatus = () => {
    setStatus('')
  }

  return {
    frameCircle,
    setFrameCircle,
    setFrameCircleFromUser,
    resetFrameCircleAuto,
    error,
    status,
    clearStatus,
    snapFrameMask,
  }
}
