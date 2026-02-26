import type { FrameCircle } from '../types'

const circleCache = new Map<string, FrameCircle>()
const STORAGE_PREFIX = 'zodiac_editor.frameCircle.'

const ANGLE_STEP_DEG = 2
const RADIUS_STEP_PX = 2

export async function detectInnerCircleFromImage(frameUrl: string): Promise<FrameCircle> {
  const cached = circleCache.get(frameUrl)
  if (cached) {
    return cached
  }
  const stored = readStoredCircle(frameUrl)
  if (stored) {
    circleCache.set(frameUrl, stored)
    return stored
  }

  const image = await loadImage(frameUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('Failed to acquire canvas context')
  }
  context.drawImage(image, 0, 0)
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  const center = findEmptyCenter(data, width, height)
  const cx = center.cx
  const cy = center.cy
  const maxRadius = Math.max(0, Math.min(cx, cy, width - cx, height - cy))
  const boundaryRadii: number[] = []

  for (let angleDeg = 0; angleDeg < 360; angleDeg += ANGLE_STEP_DEG) {
    const angleRad = (angleDeg * Math.PI) / 180
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)
    let boundary = maxRadius
    for (let r = 0; r <= maxRadius; r += RADIUS_STEP_PX) {
      const x = Math.round(cx + r * cos)
      const y = Math.round(cy + r * sin)
      if (x < 0 || x >= width || y < 0 || y >= height) {
        boundary = r
        break
      }
       if (!isMaskPixel(data, width, x, y, 245, 0)) {
         boundary = r
         break
       }
     }
    boundaryRadii.push(boundary)
  }

  const boundary = percentile(boundaryRadii, 0.2)
  const safetyMarginPx = Math.round(width * 0.002)
  const radius = Math.max(0, boundary - safetyMarginPx)

  const circle: FrameCircle = {
    cxNorm: cx / width,
    cyNorm: cy / height,
    rNorm: radius / width,
    rxNorm: radius / width,
    ryNorm: radius / height,
  }
  circleCache.set(frameUrl, circle)
  writeStoredCircle(frameUrl, circle)
  return circle
}

export async function detectMaskEllipseFromImage(
  frameUrl: string,
  whiteCutoff: number,
  offwhiteBoost: number,
  centerOverride?: { cxNorm: number; cyNorm: number }
): Promise<FrameCircle> {
  const image = await loadImage(frameUrl)
  const canvas = document.createElement('canvas')
  canvas.width = image.width
  canvas.height = image.height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('Failed to acquire canvas context')
  }
  context.drawImage(image, 0, 0)
  const { data, width, height } = context.getImageData(0, 0, canvas.width, canvas.height)
  const center = centerOverride
    ? { cx: centerOverride.cxNorm * width, cy: centerOverride.cyNorm * height }
    : findEmptyCenter(data, width, height)
  const cx = center.cx
  const cy = center.cy
  const maxRadius = Math.max(0, Math.min(cx, cy, width - cx, height - cy))
  const boundaryRadii: number[] = []

  for (let angleDeg = 0; angleDeg < 360; angleDeg += ANGLE_STEP_DEG) {
    const angleRad = (angleDeg * Math.PI) / 180
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)
    let boundary = maxRadius
    for (let r = 0; r <= maxRadius; r += RADIUS_STEP_PX) {
      const x = Math.round(cx + r * cos)
      const y = Math.round(cy + r * sin)
      if (x < 0 || x >= width || y < 0 || y >= height) {
        boundary = r
        break
      }
      if (!isMaskPixel(data, width, x, y, whiteCutoff, offwhiteBoost)) {
        boundary = r
        break
      }
    }
    boundaryRadii.push(boundary)
  }

  const fit = fitEllipse(boundaryRadii)
  const safetyMarginPx = Math.round(width * 0.002)
  const rx = Math.max(0, fit.rx - safetyMarginPx)
  const ry = Math.max(0, fit.ry - safetyMarginPx)

  const circle: FrameCircle = {
    cxNorm: cx / width,
    cyNorm: cy / height,
    rNorm: Math.min(rx / width, ry / width),
    rxNorm: rx / width,
    ryNorm: ry / height,
  }
  return circle
}

function findEmptyCenter(
  data: Uint8ClampedArray,
  width: number,
  height: number
): { cx: number; cy: number } {
  let sumX = 0
  let sumY = 0
  let count = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (isMaskPixel(data, width, x, y, 245, 0)) {
        sumX += x
        sumY += y
        count += 1
      }
    }
  }
  if (count < width * height * 0.01) {
    return { cx: width / 2, cy: height / 2 }
  }
  return { cx: sumX / count, cy: sumY / count }
}

function isMaskPixel(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  whiteCutoff: number,
  offwhiteBoost: number
): boolean {
  const idx = (y * width + x) * 4
  const r = data[idx]
  const g = data[idx + 1]
  const b = data[idx + 2]
  const a = data[idx + 3]
  if (a < 10) {
    return true
  }
  const rN = r / 255
  const gN = g / 255
  const bN = b / 255
  const max = Math.max(rN, gN, bN)
  const min = Math.min(rN, gN, bN)
  const saturation = max === 0 ? 0 : (max - min) / max
  const luminance = 0.2126 * rN + 0.7152 * gN + 0.0722 * bN
  const cutoff = whiteCutoff / 255
  const channelRange = Math.max(r, g, b) - Math.min(r, g, b)
  const satMax = 0.24 + offwhiteBoost * 0.002
  const rangeMax = 60 + offwhiteBoost * 0.6
  return luminance >= cutoff && saturation < satMax && channelRange <= rangeMax
}

function fitEllipse(boundaryRadii: number[]): { rx: number; ry: number } {
  if (boundaryRadii.length === 0) {
    return { rx: 0, ry: 0 }
  }
  let s11 = 0
  let s22 = 0
  let s12 = 0
  let sy1 = 0
  let sy2 = 0
  const step = (2 * Math.PI) / boundaryRadii.length
  boundaryRadii.forEach((radius, index) => {
    if (radius <= 0) {
      return
    }
    const angle = step * index
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const x1 = cos * cos
    const x2 = sin * sin
    const y = 1 / (radius * radius)
    s11 += x1 * x1
    s22 += x2 * x2
    s12 += x1 * x2
    sy1 += x1 * y
    sy2 += x2 * y
  })
  const det = s11 * s22 - s12 * s12
  if (det <= 0) {
    const fallback = percentile(boundaryRadii, 0.2)
    return { rx: fallback, ry: fallback }
  }
  const a = (sy1 * s22 - sy2 * s12) / det
  const b = (sy2 * s11 - sy1 * s12) / det
  if (a <= 0 || b <= 0) {
    const fallback = percentile(boundaryRadii, 0.2)
    return { rx: fallback, ry: fallback }
  }
  return { rx: 1 / Math.sqrt(a), ry: 1 / Math.sqrt(b) }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.floor((sorted.length - 1) * p)
  return sorted[index]
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    image.src = url
  })
}

function storageKey(frameUrl: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(frameUrl)}`
}

function readStoredCircle(frameUrl: string): FrameCircle | null {
  try {
    const raw = localStorage.getItem(storageKey(frameUrl))
    if (!raw) {
      return null
    }
    const parsed = JSON.parse(raw) as FrameCircle
    if (
      typeof parsed?.cxNorm === 'number' &&
      typeof parsed?.cyNorm === 'number' &&
      typeof parsed?.rNorm === 'number'
    ) {
      return parsed
    }
  } catch {
    return null
  }
  return null
}

function writeStoredCircle(frameUrl: string, circle: FrameCircle) {
  try {
    localStorage.setItem(storageKey(frameUrl), JSON.stringify(circle))
  } catch {
    return
  }
}
