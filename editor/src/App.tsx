import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type FrameIndex = {
  frames: FrameEntry[]
}

type FrameEntry = {
  id: string
  image: string
  meta: string
  layout?: string
}

type ChartMeta = {
  canvas: { width: number; height: number }
  chart: {
    center: { x: number; y: number }
    ring_outer: number
    ring_inner: number
    rotation_deg?: number
  }
  chart_fit?: {
    dx?: number
    dy?: number
    scale?: number
    rotation_deg?: number
  }
}

type ChartFit = {
  dx: number
  dy: number
  scale: number
  rotation_deg: number
}

type Offset = { dx: number; dy: number }

type LayoutFile = {
  overrides?: Record<string, Offset>
}

type DragState = {
  mode: 'chart-move' | 'chart-scale' | 'chart-rotate' | 'label'
  startPoint: { x: number; y: number }
  startFit: ChartFit
  labelId?: string
  startOffset?: Offset
}

const defaultChartFit: ChartFit = { dx: 0, dy: 0, scale: 1, rotation_deg: 0 }

function App() {
  const [frames, setFrames] = useState<FrameEntry[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [meta, setMeta] = useState<ChartMeta | null>(null)
  const [chartSvg, setChartSvg] = useState<string>('')
  const [chartFit, setChartFit] = useState<ChartFit>(defaultChartFit)
  const [overrides, setOverrides] = useState<Record<string, Offset>>({})
  const [initialFit, setInitialFit] = useState<ChartFit>(defaultChartFit)
  const [initialOverrides, setInitialOverrides] = useState<Record<string, Offset>>({})
  const [selectedElement, setSelectedElement] = useState<string>('')
  const [drag, setDrag] = useState<DragState | null>(null)
  const [error, setError] = useState<string>('')

  const svgRef = useRef<SVGSVGElement | null>(null)
  const chartRootRef = useRef<SVGGElement | null>(null)

  useEffect(() => {
    fetch('/frames_index.json')
      .then((response) => response.json())
      .then((data: FrameIndex) => {
        setFrames(data.frames)
        if (data.frames.length > 0) {
          setSelectedId(data.frames[0].id)
        }
      })
      .catch((err) => setError(String(err)))
  }, [])

  const selectedFrame = useMemo(
    () => frames.find((frame) => frame.id === selectedId) || null,
    [frames, selectedId]
  )

  useEffect(() => {
    if (!selectedFrame) {
      return
    }
    setError('')
    Promise.all([
      fetch(selectedFrame.meta).then((response) => response.json()),
      fetch(selectedFrame.layout || '').then((response) =>
        response.ok ? response.json() : { overrides: {} }
      ),
      fetch('/sample_chart.svg').then((response) => response.text()),
    ])
      .then(([metaData, layoutData, svgText]: [ChartMeta, LayoutFile, string]) => {
        setMeta(metaData)
        const fit = {
          dx: metaData.chart_fit?.dx ?? 0,
          dy: metaData.chart_fit?.dy ?? 0,
          scale: metaData.chart_fit?.scale ?? 1,
          rotation_deg: metaData.chart_fit?.rotation_deg ?? 0,
        }
        setChartFit(fit)
        setInitialFit(fit)
        setOverrides(layoutData.overrides || {})
        setInitialOverrides(layoutData.overrides || {})
        setChartSvg(extractChartInner(svgText))
      })
      .catch((err) => setError(String(err)))
  }, [selectedFrame])

  useEffect(() => {
    if (!chartRootRef.current || !meta) {
      return
    }
    const { x, y } = meta.chart.center
    const transform = [
      `translate(${chartFit.dx.toFixed(3)} ${chartFit.dy.toFixed(3)})`,
      `translate(${x.toFixed(3)} ${y.toFixed(3)})`,
      `rotate(${chartFit.rotation_deg.toFixed(3)})`,
      `scale(${chartFit.scale.toFixed(6)})`,
      `translate(${-x.toFixed(3)} ${-y.toFixed(3)})`,
    ].join(' ')
    chartRootRef.current.setAttribute('transform', transform)
  }, [chartFit, meta, chartSvg])

  useEffect(() => {
    if (!chartRootRef.current) {
      return
    }
    const nodes = chartRootRef.current.querySelectorAll('[id$=".label"]')
    nodes.forEach((node) => {
      const id = node.getAttribute('id') || ''
      const override = overrides[id]
      if (override) {
        node.setAttribute(
          'transform',
          `translate(${override.dx.toFixed(3)} ${override.dy.toFixed(3)})`
        )
      } else {
        node.removeAttribute('transform')
      }
    })
  }, [overrides, chartSvg])

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current || !chartRootRef.current) {
      return
    }
    const target = event.target as Element | null
    const labelElement = target?.closest('[id$=".label"]') as Element | null
    const chartElement = target?.closest('#chartRoot') as Element | null

    const point = toSvgPoint(event, svgRef.current)
    if (labelElement) {
      const id = labelElement.getAttribute('id') || ''
      const current = overrides[id] || { dx: 0, dy: 0 }
      setSelectedElement(id)
      setDrag({
        mode: 'label',
        startPoint: point,
        startFit: chartFit,
        labelId: id,
        startOffset: current,
      })
      svgRef.current.setPointerCapture(event.pointerId)
      return
    }

    if (chartElement) {
      const mode = event.shiftKey
        ? 'chart-scale'
        : event.altKey
          ? 'chart-rotate'
          : 'chart-move'
      setSelectedElement('chartRoot')
      setDrag({ mode, startPoint: point, startFit: chartFit })
      svgRef.current.setPointerCapture(event.pointerId)
    }
  }

  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drag || !svgRef.current) {
      return
    }
    const point = toSvgPoint(event, svgRef.current)
    const dx = point.x - drag.startPoint.x
    const dy = point.y - drag.startPoint.y

    if (drag.mode === 'chart-move') {
      setChartFit({
        ...drag.startFit,
        dx: drag.startFit.dx + dx,
        dy: drag.startFit.dy + dy,
      })
      return
    }
    if (drag.mode === 'chart-scale') {
      const nextScale = Math.max(0.1, drag.startFit.scale * (1 + dx / 300))
      setChartFit({ ...drag.startFit, scale: nextScale })
      return
    }
    if (drag.mode === 'chart-rotate') {
      setChartFit({
        ...drag.startFit,
        rotation_deg: drag.startFit.rotation_deg + dx,
      })
      return
    }
    if (drag.mode === 'label' && drag.labelId && drag.startOffset) {
      setOverrides((current) => ({
        ...current,
        [drag.labelId as string]: {
          dx: drag.startOffset.dx + dx,
          dy: drag.startOffset.dy + dy,
        },
      }))
    }
  }

  const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) {
      return
    }
    if (svgRef.current.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId)
    }
    setDrag(null)
  }

  const handleSaveMeta = () => {
    if (!meta) {
      return
    }
    const output = {
      ...meta,
      chart_fit: {
        dx: round(chartFit.dx),
        dy: round(chartFit.dy),
        scale: round(chartFit.scale),
        rotation_deg: round(chartFit.rotation_deg),
      },
    }
    downloadJson('metadata.json', output)
  }

  const handleSaveLayout = () => {
    const output = {
      overrides: Object.fromEntries(
        Object.entries(overrides).map(([key, value]) => [
          key,
          { dx: round(value.dx), dy: round(value.dy) },
        ])
      ),
    }
    downloadJson('layout.json', output)
  }

  const handleReset = () => {
    setChartFit(initialFit)
    setOverrides(initialOverrides)
    setSelectedElement('')
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Frame Alignment + Layout</h1>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          Frame
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
          >
            {frames.map((frame) => (
              <option key={frame.id} value={frame.id}>
                {frame.id}
              </option>
            ))}
          </select>
        </label>

        <div className="section">
          <h2>Chart Fit</h2>
          <NumberField label="dx" value={chartFit.dx} onChange={(value) =>
            setChartFit((current) => ({ ...current, dx: value }))
          } />
          <NumberField label="dy" value={chartFit.dy} onChange={(value) =>
            setChartFit((current) => ({ ...current, dy: value }))
          } />
          <NumberField label="scale" value={chartFit.scale} step={0.01} onChange={(value) =>
            setChartFit((current) => ({ ...current, scale: value }))
          } />
          <NumberField label="rotation" value={chartFit.rotation_deg} step={0.5} onChange={(value) =>
            setChartFit((current) => ({ ...current, rotation_deg: value }))
          } />
          <div className="hint">Drag to move. Shift+drag to scale. Alt+drag to rotate.</div>
        </div>

        <div className="section">
          <h2>Selection</h2>
          <div className="selection">{selectedElement || 'None'}</div>
        </div>

        <div className="actions">
          <button onClick={handleSaveMeta}>Save metadata.json</button>
          <button onClick={handleSaveLayout}>Save layout.json</button>
          <button onClick={handleReset}>Reset</button>
        </div>
      </aside>

      <main className="canvas">
        {meta ? (
          <svg
            ref={svgRef}
            width={meta.canvas.width}
            height={meta.canvas.height}
            viewBox={`0 0 ${meta.canvas.width} ${meta.canvas.height}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
          >
            {selectedFrame ? (
              <image
                href={selectedFrame.image}
                x={0}
                y={0}
                width={meta.canvas.width}
                height={meta.canvas.height}
              />
            ) : null}
            <circle
              cx={meta.chart.center.x}
              cy={meta.chart.center.y}
              r={meta.chart.ring_outer}
              fill="none"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={2}
            />
            <circle
              cx={meta.chart.center.x}
              cy={meta.chart.center.y}
              r={meta.chart.ring_inner}
              fill="none"
              stroke="rgba(0,0,0,0.2)"
              strokeWidth={2}
            />
            <g className="crosshair">
              <line
                x1={meta.chart.center.x - 20}
                y1={meta.chart.center.y}
                x2={meta.chart.center.x + 20}
                y2={meta.chart.center.y}
              />
              <line
                x1={meta.chart.center.x}
                y1={meta.chart.center.y - 20}
                x2={meta.chart.center.x}
                y2={meta.chart.center.y + 20}
              />
            </g>
            <g ref={chartRootRef} id="chartRoot" dangerouslySetInnerHTML={{ __html: chartSvg }} />
          </svg>
        ) : (
          <div className="placeholder">Select a frame to begin.</div>
        )}
      </main>
    </div>
  )
}

function extractChartInner(svgText: string): string {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const chartRoot = doc.querySelector('#chartRoot')
  if (chartRoot) {
    return chartRoot.innerHTML
  }
  return doc.documentElement.innerHTML
}

function toSvgPoint(event: React.PointerEvent, svg: SVGSVGElement) {
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

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function NumberField({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string
  value: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function round(value: number) {
  return Math.round(value * 1000) / 1000
}

export default App
