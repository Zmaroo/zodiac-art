import type { PointerEvent } from 'react'

export function toSvgPoint(event: PointerEvent, svg: SVGSVGElement) {
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) {
    return { x: event.clientX, y: event.clientY }
  }
  const transformed = point.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

export function toNodePoint(event: PointerEvent, node: SVGGElement) {
  const point = node.ownerSVGElement?.createSVGPoint()
  if (!point) {
    return { x: event.clientX, y: event.clientY }
  }
  point.x = event.clientX
  point.y = event.clientY
  const ctm = node.getScreenCTM()
  if (!ctm) {
    return { x: event.clientX, y: event.clientY }
  }
  const transformed = point.matrixTransform(ctm.inverse())
  return { x: transformed.x, y: transformed.y }
}

export function polarOffsetToXY(dr: number, dt: number, thetaDeg: number) {
  const angle = (Math.PI / 180) * thetaDeg
  return {
    dx: dr * Math.cos(angle) - dt * Math.sin(angle),
    dy: dr * Math.sin(angle) + dt * Math.cos(angle),
  }
}
