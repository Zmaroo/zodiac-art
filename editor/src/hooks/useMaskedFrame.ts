import { useEffect, useState } from 'react'

const maskedCache = new Map<string, string>()

function maskFrameWhite(
  image: HTMLImageElement,
  center: { x: number; y: number },
  radiusX: number,
  radiusY: number,
  whiteCutoff: number,
  offwhiteBoost: number
): string {
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) {
    throw new Error('Failed to acquire canvas context')
  }
  ctx.drawImage(image, 0, 0)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const { data } = imageData
  const rx2 = radiusX * radiusX
  const ry2 = radiusY * radiusY
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const dx = x - center.x
      const dy = y - center.y
      if ((dx * dx) / rx2 + (dy * dy) / ry2 > 1) {
        continue
      }
      const i = (y * canvas.width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]
      if (a < 10) {
        continue
      }
      const rN = r / 255
      const gN = g / 255
      const bN = b / 255
      const max = Math.max(rN, gN, bN)
      const min = Math.min(rN, gN, bN)
      const saturation = max == 0 ? 0 : (max - min) / max
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b
      const channelRange = Math.max(r, g, b) - Math.min(r, g, b)
      const satMax = 0.24 + offwhiteBoost * 0.002
      const rangeMax = 60 + offwhiteBoost * 0.6
      const nearWhite = luma >= whiteCutoff && saturation < satMax && channelRange <= rangeMax
      if (nearWhite) {
        data[i + 3] = 0
      }
    }
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

export function useMaskedFrame(
  frameUrl: string,
  enabled: boolean,
  center: { x: number; y: number },
  radiusX: number,
  radiusY: number,
  whiteCutoff: number,
  offwhiteBoost: number
) {
  const [maskedUrl, setMaskedUrl] = useState('')

  useEffect(() => {
    if (!enabled || !frameUrl || radiusX <= 0 || radiusY <= 0) {
      setMaskedUrl('')
      return
    }
    const cacheKey = `${frameUrl}:${center.x}:${center.y}:${radiusX}:${radiusY}:${whiteCutoff}:${offwhiteBoost}`
    const cached = maskedCache.get(cacheKey)
    if (cached) {
      setMaskedUrl(cached)
      return
    }
    let cancelled = false
    let objectUrl = ''
    const image = new Image()
    const clearObjectUrl = () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl)
        objectUrl = ''
      }
    }
    image.onload = () => {
      if (cancelled) {
        clearObjectUrl()
        return
      }
      try {
        const url = maskFrameWhite(image, center, radiusX, radiusY, whiteCutoff, offwhiteBoost)
        maskedCache.set(cacheKey, url)
        setMaskedUrl(url)
      } catch {
        setMaskedUrl('')
      } finally {
        clearObjectUrl()
      }
    }
    image.onerror = () => {
      if (!cancelled) {
        setMaskedUrl('')
      }
      clearObjectUrl()
    }
    fetch(frameUrl, { mode: 'cors' })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to fetch frame image')
        }
        return response.blob()
      })
      .then((blob) => {
        if (cancelled) {
          return
        }
        objectUrl = URL.createObjectURL(blob)
        image.src = objectUrl
      })
      .catch(() => {
        if (!cancelled) {
          setMaskedUrl('')
        }
      })
    return () => {
      cancelled = true
      clearObjectUrl()
    }
  }, [enabled, frameUrl, center, radiusX, radiusY, whiteCutoff, offwhiteBoost])

  return maskedUrl
}
