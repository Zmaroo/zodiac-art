import type { Offset } from '../types'

export function round(value: number) {
  return Math.round(value * 1000) / 1000
}

export function normalizeOverride(value: Offset) {
  const dx = Number.isFinite(value.dx) ? round(value.dx as number) : 0
  const dy = Number.isFinite(value.dy) ? round(value.dy as number) : 0
  const override: Record<string, number | string> = { dx, dy }
  if (Number.isFinite(value.dr)) {
    override.dr = round(value.dr as number)
  }
  if (Number.isFinite(value.dt)) {
    override.dt = round(value.dt as number)
  }
  if (value.color) {
    override.color = value.color
  }
  return override
}

export function isDraggableElement(id: string) {
  return (
    (id.startsWith('planet.') && id.endsWith('.glyph')) ||
    id.startsWith('sign.') ||
    id === 'asc.marker'
  )
}
