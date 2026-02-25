import { useState, type ChangeEvent } from 'react'
import CollapsibleSection from '../CollapsibleSection'
import NumberField from '../NumberField'
import SelectionSection from './SelectionSection'
import type {
  ActiveSelectionLayer,
  ChartFit,
  ChartOccluder,
  DesignSettings,
  LayerOrderKey,
} from '../../types'

export type DesignSectionProps = {
  chartFit: {
    value: ChartFit
    onChange: (next: ChartFit) => void
  }
  layering: {
    design: DesignSettings
    onLayerOrderChange: (value: LayerOrderKey[]) => void
    onLayerOpacityChange: (layer: LayerOrderKey, value: number) => void
    hasFrame: boolean
    hasChartBackground: boolean
    hasBackgroundImage: boolean
  }
  backgroundImage: {
    path: string | null
    url: string
    error: string
    status: string
    uploading: boolean
    onUpload: (file: File | null) => void
    onClear: () => void
    scale: number
    dx: number
    dy: number
    onScaleChange: (value: number) => void
    onDxChange: (value: number) => void
    onDyChange: (value: number) => void
  }
  glyphScale: {
    onSignGlyphScaleChange: (value: number) => void
    onPlanetGlyphScaleChange: (value: number) => void
    onInnerRingScaleChange: (value: number) => void
  }
  occluders: {
    items: ChartOccluder[]
    selectedId: string
    onSelect: (id: string) => void
    onAddEllipse: () => void
    onAddRect: () => void
    onDelete: (id: string) => void
    onUpdate: (id: string, next: ChartOccluder) => void
    onSnapToChart: () => void
    canSnap: boolean
  }
  selection: {
    selectedElement: string
    selectableGroups: { label: string; items: { id: string; label: string }[] }[]
    onSelectedElementChange: (value: string) => void
    activeSelectionLayer: ActiveSelectionLayer
    onActiveSelectionLayerChange: (value: ActiveSelectionLayer) => void
    selectionColor: string
    selectionColorMixed: boolean
    selectionEnabled: boolean
    onColorChange: (color: string) => void
    onClearColor: () => void
    chartLinesColor: string
    onChartLinesColorChange: (color: string) => void
    onClearChartLinesColor: () => void
    chartBackgroundColor: string
    onChartBackgroundColorChange: (color: string) => void
    onClearChartBackgroundColor: () => void
    radialMoveEnabled: boolean
    onRadialMoveEnabledChange: (value: boolean) => void
    frameMaskCutoff: number
    onFrameMaskCutoffChange: (value: number) => void
  }
}

const LAYER_LABELS: Record<LayerOrderKey, string> = {
  background: 'Chart background',
  chart_background_image: 'Background image',
  chart: 'Chart',
  frame: 'Frame',
}

const LAYER_SELECTION_IDS: Partial<Record<LayerOrderKey, string>> = {
  chart_background_image: 'chart.background_image',
}

const LAYER_ACTIVE_KEYS: Partial<Record<LayerOrderKey, ActiveSelectionLayer>> = {
  chart_background_image: 'background_image',
  chart: 'chart',
}

function DesignSection({
  chartFit,
  layering,
  backgroundImage,
  glyphScale,
  occluders,
  selection,
}: DesignSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(
    () => localStorage.getItem('zodiac_editor.designAdvanced') === 'true'
  )
  const isLayerVisible = (layerKey: LayerOrderKey) => {
    if (layerKey === 'chart') {
      return true
    }
    if (layerKey === 'background') {
      return layering.hasChartBackground
    }
    if (layerKey === 'frame') {
      return layering.hasFrame
    }
    if (layerKey === 'chart_background_image') {
      return layering.hasBackgroundImage
    }
    return true
  }

  const visibleLayerOrder = layering.design.layer_order.filter(isLayerVisible)
  const activeOccluder = occluders.items.find((item) => item.id === occluders.selectedId) ?? null
  const occluderLayerActive = selection.activeSelectionLayer === 'occluder'

  const moveLayer = (order: LayerOrderKey[], index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= order.length) {
      return
    }
    const layerId = order[index]
    const swapId = order[target]
    const next = [...layering.design.layer_order]
    const fromIndex = next.indexOf(layerId)
    const toIndex = next.indexOf(swapId)
    if (fromIndex < 0 || toIndex < 0) {
      return
    }
    next[fromIndex] = swapId
    next[toIndex] = layerId
    layering.onLayerOrderChange(next)
  }
  const handleBackgroundImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    backgroundImage.onUpload(file)
    event.target.value = ''
  }
  return (
    <CollapsibleSection title="Design" persistKey="design">
      <div className="subsection-title">Background image</div>
      <label className="field">
        Upload PNG for chart background if desired
        <input
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp"
          onChange={handleBackgroundImageChange}
          disabled={backgroundImage.uploading}
        />
      </label>
      {backgroundImage.path ? (
        <div className="layer-image-preview">
          {backgroundImage.url ? (
            <img src={backgroundImage.url} alt="Chart background" />
          ) : null}
          <button type="button" className="secondary" onClick={backgroundImage.onClear}>
            Remove image
          </button>
        </div>
      ) : (
        <div className="hint">No background image uploaded.</div>
      )}
      {backgroundImage.error ? <div className="inline-error">{backgroundImage.error}</div> : null}
      {backgroundImage.status ? (
        <div className="inline-status">{backgroundImage.status}</div>
      ) : null}
      <label className="field checkbox">
        Show advanced controls
        <input
          type="checkbox"
          checked={showAdvanced}
          onChange={(event) => {
            const next = event.target.checked
            setShowAdvanced(next)
            localStorage.setItem('zodiac_editor.designAdvanced', String(next))
          }}
        />
      </label>
      {showAdvanced ? (
        <>
          <div className="subsection-title">Background image transform</div>
          <NumberField
            label="scale"
            value={backgroundImage.scale}
            step={0.05}
            onChange={backgroundImage.onScaleChange}
          />
          <NumberField
            label="x"
            value={backgroundImage.dx}
            step={1}
            onChange={backgroundImage.onDxChange}
          />
          <NumberField
            label="y"
            value={backgroundImage.dy}
            step={1}
            onChange={backgroundImage.onDyChange}
          />
          <div className="subsection-title">Chart Fit</div>
          <NumberField
            label="dx"
            value={chartFit.value.dx}
            onChange={(value) => chartFit.onChange({ ...chartFit.value, dx: value })}
          />
          <NumberField
            label="dy"
            value={chartFit.value.dy}
            onChange={(value) => chartFit.onChange({ ...chartFit.value, dy: value })}
          />
          <NumberField
            label="scale"
            value={chartFit.value.scale}
            step={0.01}
            onChange={(value) => chartFit.onChange({ ...chartFit.value, scale: value })}
          />
          <NumberField
            label="rotation"
            value={chartFit.value.rotation_deg}
            step={0.5}
            onChange={(value) =>
              chartFit.onChange({ ...chartFit.value, rotation_deg: value })
            }
          />
          <div className="hint">Drag to move. Shift+drag to scale. Alt+drag to rotate.</div>
        </>
      ) : null}
      <div className="subsection-title">Chart Occluders</div>
      <div className="button-grid">
        <button type="button" className="secondary" onClick={occluders.onAddEllipse}>
          Add ellipse
        </button>
        <button type="button" className="secondary" onClick={occluders.onAddRect}>
          Add rectangle
        </button>
      </div>
      <label className="field">
        Select occluder
        <select
          value={occluders.selectedId}
          onChange={(event) => occluders.onSelect(event.target.value)}
        >
          <option value="">None</option>
          {occluders.items.map((item, index) => (
            <option key={item.id} value={item.id}>
              {item.shape} {index + 1}
            </option>
          ))}
        </select>
      </label>
      <label className="field checkbox">
        Edit occluders on canvas
        <input
          type="checkbox"
          checked={occluderLayerActive}
          onChange={(event) =>
            selection.onActiveSelectionLayerChange(event.target.checked ? 'occluder' : 'auto')
          }
        />
      </label>
      {activeOccluder ? (
        <>
          {activeOccluder.shape === 'ellipse' ? (
            <>
              <NumberField
                label="cx"
                value={activeOccluder.cx}
                step={1}
                onChange={(value) =>
                  occluders.onUpdate(activeOccluder.id, { ...activeOccluder, cx: value })
                }
              />
              <NumberField
                label="cy"
                value={activeOccluder.cy}
                step={1}
                onChange={(value) =>
                  occluders.onUpdate(activeOccluder.id, { ...activeOccluder, cy: value })
                }
              />
              <NumberField
                label="rx"
                value={activeOccluder.rx}
                step={1}
                onChange={(value) =>
                  occluders.onUpdate(activeOccluder.id, { ...activeOccluder, rx: value })
                }
              />
              <NumberField
                label="ry"
                value={activeOccluder.ry}
                step={1}
                onChange={(value) =>
                  occluders.onUpdate(activeOccluder.id, { ...activeOccluder, ry: value })
                }
              />
            </>
          ) : (
            <>
              <NumberField
                label="x"
                value={activeOccluder.x}
                step={1}
                onChange={(value) =>
                  occluders.onUpdate(activeOccluder.id, { ...activeOccluder, x: value })
                }
              />
              <NumberField
                label="y"
                value={activeOccluder.y}
                step={1}
                onChange={(value) =>
                  occluders.onUpdate(activeOccluder.id, { ...activeOccluder, y: value })
                }
              />
              <NumberField
                label="width"
                value={activeOccluder.width}
                step={1}
                onChange={(value) =>
                  occluders.onUpdate(activeOccluder.id, { ...activeOccluder, width: value })
                }
              />
              <NumberField
                label="height"
                value={activeOccluder.height}
                step={1}
                onChange={(value) =>
                  occluders.onUpdate(activeOccluder.id, { ...activeOccluder, height: value })
                }
              />
            </>
          )}
          <NumberField
            label="rotation"
            value={activeOccluder.rotation_deg ?? 0}
            step={1}
            onChange={(value) =>
              occluders.onUpdate(activeOccluder.id, { ...activeOccluder, rotation_deg: value })
            }
          />
          <button
            type="button"
            className="secondary"
            onClick={() => occluders.onDelete(activeOccluder.id)}
          >
            Delete occluder
          </button>
          <button
            type="button"
            className="secondary"
            onClick={occluders.onSnapToChart}
            disabled={!occluders.canSnap}
          >
            Snap to chart circle
          </button>
          <div className="hint">Use the occluder layer to drag shapes on canvas.</div>
        </>
      ) : (
        <div className="hint">Add an occluder to hide chart areas under the frame.</div>
      )}
      <div className="subsection-title">Layering (top → bottom)</div>
      <div className="layer-stack">
        {[...visibleLayerOrder].reverse().map((layerKey, index, order) => {
          const opacity = layering.design.layer_opacity?.[layerKey] ?? 1
          const selectionId = LAYER_SELECTION_IDS[layerKey]
          const activeKey = LAYER_ACTIVE_KEYS[layerKey]
          const isActiveLayer = Boolean(activeKey && selection.activeSelectionLayer === activeKey)
          const isSelected = Boolean(selectionId && selectionId === selection.selectedElement)
          const handleLayerActivate = () => {
            if (!activeKey) {
              return
            }
            const next =
              selection.activeSelectionLayer === activeKey ? 'auto' : activeKey
            selection.onActiveSelectionLayerChange(next)
            if (selectionId && next !== 'auto') {
              selection.onSelectedElementChange(selectionId)
            }
          }
          return (
            <div
              className={`layer-row${isActiveLayer ? ' active-layer' : ''}${isSelected ? ' active' : ''}`}
              key={layerKey}
            >
              <div className="layer-row-header">
                {activeKey ? (
                  <button
                    type="button"
                    className={`layer-label-button${isActiveLayer ? ' active-layer' : ''}`}
                    onClick={handleLayerActivate}
                    aria-label={`Activate ${LAYER_LABELS[layerKey]} layer`}
                  >
                    {LAYER_LABELS[layerKey]}
                  </button>
                ) : (
                  <span className="layer-label">{LAYER_LABELS[layerKey]}</span>
                )}
                {isActiveLayer ? <span className="layer-active">Active layer</span> : null}
                <div className="layer-controls">
                  <button
                    type="button"
                    className="layer-button"
                    onClick={() => moveLayer(order, index, -1)}
                    disabled={index === 0}
                    aria-label="Move layer up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="layer-button"
                    onClick={() => moveLayer(order, index, 1)}
                    disabled={index === order.length - 1}
                    aria-label="Move layer down"
                  >
                    ↓
                  </button>
                </div>
              </div>
              <label className="field layer-opacity">
                Opacity
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={opacity}
                    onChange={(event) =>
                      layering.onLayerOpacityChange(layerKey, Number(event.target.value))
                    }
                  />
                <div className="hint">{Math.round(opacity * 100)}%</div>
              </label>
            </div>
          )
        })}
      </div>
      <div className="subsection-title">Rings + Glyphs</div>
      <label className="field">
        Sign glyph size
        <input
          type="range"
          min={0.7}
          max={1.3}
          step={0.01}
          value={layering.design.sign_glyph_scale}
          onChange={(event) => glyphScale.onSignGlyphScaleChange(Number(event.target.value))}
        />
        <div className="hint">{layering.design.sign_glyph_scale.toFixed(2)}</div>
      </label>
      <label className="field">
        Planet glyph size
        <input
          type="range"
          min={0.7}
          max={1.3}
          step={0.01}
          value={layering.design.planet_glyph_scale}
          onChange={(event) => glyphScale.onPlanetGlyphScaleChange(Number(event.target.value))}
        />
        <div className="hint">{layering.design.planet_glyph_scale.toFixed(2)}</div>
      </label>
      <label className="field">
        Inner ring scale
        <input
          type="range"
          min={0.85}
          max={1.15}
          step={0.01}
          value={layering.design.inner_ring_scale}
          onChange={(event) => glyphScale.onInnerRingScaleChange(Number(event.target.value))}
        />
        <div className="hint">{layering.design.inner_ring_scale.toFixed(2)}</div>
      </label>
      <div className="subsection-title">Selection</div>
      <SelectionSection
        wrapInSection={false}
        selectedElement={selection.selectedElement}
        selectableGroups={selection.selectableGroups}
        onSelectedElementChange={selection.onSelectedElementChange}
        selectionColor={selection.selectionColor}
        selectionColorMixed={selection.selectionColorMixed}
        selectionEnabled={selection.selectionEnabled}
        onColorChange={selection.onColorChange}
        onClearColor={selection.onClearColor}
        chartLinesColor={selection.chartLinesColor}
        onChartLinesColorChange={selection.onChartLinesColorChange}
        onClearChartLinesColor={selection.onClearChartLinesColor}
        chartBackgroundColor={selection.chartBackgroundColor}
        onChartBackgroundColorChange={selection.onChartBackgroundColorChange}
        onClearChartBackgroundColor={selection.onClearChartBackgroundColor}
        radialMoveEnabled={selection.radialMoveEnabled}
        onRadialMoveEnabledChange={selection.onRadialMoveEnabledChange}
        frameMaskCutoff={selection.frameMaskCutoff}
        onFrameMaskCutoffChange={selection.onFrameMaskCutoffChange}
      />
    </CollapsibleSection>
  )
}

export default DesignSection
