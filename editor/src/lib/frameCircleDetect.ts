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
  const cx = width / 2
  const cy = height / 2
  const maxRadius = Math.min(width, height) / 2
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
      if (!isEmptyPixel(data, width, x, y)) {
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
  }
  circleCache.set(frameUrl, circle)
  writeStoredCircle(frameUrl, circle)
  return circle
}

function isEmptyPixel(data: Uint8ClampedArray, width: number, x: number, y: number): boolean {
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
  return luminance > 0.95 && saturation < 0.1
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
  } catch (err) {
    return null
  }
  return null
}

function writeStoredCircle(frameUrl: string, circle: FrameCircle) {
  try {
    localStorage.setItem(storageKey(frameUrl), JSON.stringify(circle))
  } catch (err) {
    return
  }
}
