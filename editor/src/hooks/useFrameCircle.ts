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
  lastUpdateReason: string
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
  const [lastUpdateReason, setLastUpdateReason] = useState('')
  const lastFrameIdRef = useRef<string>('')
  const skipInitialFrameResetRef = useRef(false)
  const userChangeRef = useRef(false)
  const userClearedRef = useRef(false)

  const setFrameCircleWithReason = useCallback((circle: FrameCircle | null, reason: string) => {
    setLastUpdateReason(reason)
    setFrameCircle(circle)
  }, [])

  const setFrameCircleExternal = useCallback((circle: FrameCircle | null) => {
    if (lastFrameIdRef.current == '' && circle) {
      skipInitialFrameResetRef.current = true
    }
    setFrameCircleWithReason(circle, 'external')
  }, [setFrameCircleWithReason])

  useEffect(() => {
    if (!frameCircleLocked) {
      return
    }
    userClearedRef.current = true
    userChangeRef.current = true
    queueMicrotask(() => {
      setFrameCircleWithReason(null, 'locked-clear')
    })
  }, [frameCircleLocked, setFrameCircleWithReason])

  const setFrameCircleFromUser = useCallback((circle: FrameCircle | null) => {
    userChangeRef.current = true
    userClearedRef.current = circle === null
    if (lastFrameIdRef.current === '') {
      skipInitialFrameResetRef.current = true
    }
    setFrameCircleWithReason(circle, circle ? 'user-set' : 'user-clear')
  }, [setFrameCircleWithReason])

  const resetFrameCircleAuto = useCallback(() => {
    userClearedRef.current = false
    userChangeRef.current = false
    setFrameCircleWithReason(null, 'auto-reset')
  }, [setFrameCircleWithReason])

  useEffect(() => {
    const frameId = selectedFrameDetail?.id ?? ''
    if (frameId && frameId !== lastFrameIdRef.current) {
      if (lastFrameIdRef.current === '' && skipInitialFrameResetRef.current) {
        skipInitialFrameResetRef.current = false
        lastFrameIdRef.current = frameId
        return
      }
      lastFrameIdRef.current = frameId
      userChangeRef.current = false
      userClearedRef.current = false
      queueMicrotask(() => {
        setFrameCircleWithReason(null, 'frame-change-reset')
      })
      return
    }
    if (!selectedFrameDetail) {
      userClearedRef.current = false
      queueMicrotask(() => {
        setFrameCircleWithReason(null, 'frame-clear-reset')
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
        if (!userClearedRef.current && !userChangeRef.current && !frameCircleLocked) {
          setFrameCircleWithReason(circle, 'auto-meta')
        }
      })
      return
    }
    const frameUrl = `${apiBase}${selectedFrameDetail.image_url}`
    let cancelled = false
    detectInnerCircleFromImage(frameUrl)
      .then((circle) => {
        if (!cancelled && !userClearedRef.current && !userChangeRef.current) {
          setFrameCircleWithReason(circle, 'auto-detect')
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err))
          setFrameCircleWithReason(null, 'auto-detect-error')
        }
      })
    return () => {
      cancelled = true
    }
  }, [apiBase, frameCircle, frameCircleLocked, selectedFrameDetail, setFrameCircleWithReason])

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
          setFrameCircleWithReason(circle, 'snap-mask')
          setError('')
        })
        .catch((err) => setError(String(err)))
    },
    [apiBase, frameCircle, selectedFrameDetail, setFrameCircleWithReason]
  )

  const clearStatus = () => {
    setStatus('')
  }

  return {
    frameCircle,
    setFrameCircle: setFrameCircleExternal,
    setFrameCircleFromUser,
    resetFrameCircleAuto,
    error,
    status,
    clearStatus,
    snapFrameMask,
    lastUpdateReason,
  }
}
