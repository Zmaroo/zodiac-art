import type { Offset } from '../types'
import { polarOffsetToXY } from './geometry'

export function extractChartInner(svgText: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const chartRoot = doc.querySelector('#chartRoot')
  if (chartRoot) {
    return chartRoot.innerHTML
  }
  return doc.documentElement.innerHTML
}

export function stripOverrideTransforms(svgInner: string, overrides: Record<string, Offset>) {
  if (!svgInner) {
    return svgInner
  }
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svgInner}</svg>`,
    'image/svg+xml'
  )
  const keys = Object.keys(overrides)
  if (keys.length === 0) {
    return svgInner
  }
  keys.forEach((key) => {
    const node = doc.querySelector(`[id="${CSS.escape(key)}"]`)
    if (node) {
      node.removeAttribute('transform')
    }
  })
  return doc.documentElement.innerHTML
}

export function applyOverrides(
  svgInner: string,
  overrides: Record<string, Offset>
) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${svgInner}</svg>`,
    'image/svg+xml'
  )
  const nodes = doc.querySelectorAll('[id]')
  nodes.forEach((node) => {
    const id = node.getAttribute('id') || ''
    const override = overrides[id]
    if (!override) {
      return
    }
    if (override.color) {
      applyColor(node, override.color)
    }
    const theta = Number(node.getAttribute('data-theta'))
    let dx = override.dx ?? 0
    let dy = override.dy ?? 0
    if ((override.dr !== undefined || override.dt !== undefined) && Number.isFinite(theta)) {
      const offset = polarOffsetToXY(override.dr ?? 0, override.dt ?? 0, theta)
      dx = offset.dx
      dy = offset.dy
    }
    const translate = `translate(${dx.toFixed(3)} ${dy.toFixed(3)})`
    const existing = node.getAttribute('transform')
    node.setAttribute('transform', existing ? `${existing} ${translate}` : translate)
  })
  return doc.documentElement.innerHTML
}

function applyColor(node: Element, color: string) {
  const fillOnly = node.getAttribute('data-fill-only') === 'true'
  node.setAttribute('fill', color)
  if (!fillOnly) {
    node.setAttribute('stroke', color)
  }
  node.querySelectorAll('*').forEach((child) => {
    child.setAttribute('fill', color)
    if (!fillOnly) {
      child.setAttribute('stroke', color)
    }
  })
}
