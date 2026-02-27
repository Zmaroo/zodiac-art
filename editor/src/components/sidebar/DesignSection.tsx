import type { ChangeEvent } from 'react'
import CollapsibleSection from '../CollapsibleSection'
import NumberField from '../NumberField'
import type {
  ActiveSelectionLayer,
  ChartFit,
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
    frameMaskOffwhiteBoost: number
    onFrameMaskOffwhiteBoostChange: (value: number) => void
    frameMaskEnabled: boolean
    onFrameMaskActivate: () => void
    frameMaskGuideVisible: boolean
    onFrameMaskGuideVisibleChange: (value: boolean) => void
    frameMaskLockAspect: boolean
    onFrameMaskLockAspectChange: (value: boolean) => void
    onSnapFrameMask: () => void
    onClearFrameMask: () => void
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
  selection,
}: DesignSectionProps) {
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
    <>
      <CollapsibleSection title="Background image" persistKey="design-background-image">
        <label className="field" htmlFor="background-image">
          Upload PNG for chart background if desired
          <input
            type="file"
            id="background-image"
            name="background-image"
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
      </CollapsibleSection>

      <CollapsibleSection
        title="Background image transform"
        persistKey="design-background-transform"
      >
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
      </CollapsibleSection>

      <CollapsibleSection title="Chart fit" persistKey="design-chart-fit">
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
          onChange={(value) => chartFit.onChange({ ...chartFit.value, rotation_deg: value })}
        />
        <div className="hint">Drag to move. Shift+drag to scale. Alt+drag to rotate.</div>
      </CollapsibleSection>

      <CollapsibleSection title="Layering" persistKey="design-layering">
        <div className="layer-stack">
          {[...visibleLayerOrder].reverse().map((layerKey, index, order) => {
            const opacity = layering.design.layer_opacity?.[layerKey] ?? 1
            const selectionId = LAYER_SELECTION_IDS[layerKey]
            const activeKey = LAYER_ACTIVE_KEYS[layerKey]
            const isActiveLayer = Boolean(
              activeKey && selection.activeSelectionLayer === activeKey
            )
            const isSelected = Boolean(selectionId && selectionId === selection.selectedElement)
            const handleLayerActivate = () => {
              if (!activeKey) {
                return
              }
              const next = selection.activeSelectionLayer === activeKey ? 'auto' : activeKey
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
                <label className="field layer-opacity" htmlFor={`layer-opacity-${layerKey}`}>
                  Opacity
                  <input
                    type="range"
                    id={`layer-opacity-${layerKey}`}
                    name={`layer-opacity-${layerKey}`}
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
      </CollapsibleSection>

      <CollapsibleSection title="Glyphs + inner ring" persistKey="design-glyphs">
        <label className="field" htmlFor="sign-glyph-scale">
          Sign glyph size
          <input
            type="range"
            id="sign-glyph-scale"
            name="sign-glyph-scale"
            min={0.7}
            max={1.3}
            step={0.01}
            value={layering.design.sign_glyph_scale}
            onChange={(event) => glyphScale.onSignGlyphScaleChange(Number(event.target.value))}
          />
          <div className="hint">{layering.design.sign_glyph_scale.toFixed(2)}</div>
        </label>
        <label className="field" htmlFor="planet-glyph-scale">
          Planet glyph size
          <input
            type="range"
            id="planet-glyph-scale"
            name="planet-glyph-scale"
            min={0.7}
            max={1.3}
            step={0.01}
            value={layering.design.planet_glyph_scale}
            onChange={(event) => glyphScale.onPlanetGlyphScaleChange(Number(event.target.value))}
          />
          <div className="hint">{layering.design.planet_glyph_scale.toFixed(2)}</div>
        </label>
        <label className="field" htmlFor="inner-ring-scale">
          Inner ring scale
          <input
            type="range"
            id="inner-ring-scale"
            name="inner-ring-scale"
            min={0.85}
            max={1.15}
            step={0.01}
            value={layering.design.inner_ring_scale}
            onChange={(event) => glyphScale.onInnerRingScaleChange(Number(event.target.value))}
          />
          <div className="hint">{layering.design.inner_ring_scale.toFixed(2)}</div>
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Selection + colors" persistKey="design-selection">
        <label className="field" htmlFor="selection-element">
          Select element
          <select
            id="selection-element"
            name="selection-element"
            value={selection.selectedElement}
            onChange={(event) => selection.onSelectedElementChange(event.target.value)}
          >
            <option value="">None</option>
            {selection.selectableGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className="field" htmlFor="chart-lines-color">
          Chart lines color
          <div className="color-row">
            <input
              type="color"
              id="chart-lines-color"
              name="chart-lines-color"
              value={selection.chartLinesColor || '#000000'}
              onChange={(event) => selection.onChartLinesColorChange(event.target.value)}
            />
            <button
              type="button"
              className="secondary"
              onClick={selection.onClearChartLinesColor}
            >
              Reset
            </button>
          </div>
          <div className="hint">Applies to inner/outer rings + cusp lines.</div>
        </label>
        <label className="field" htmlFor="chart-background-color">
          Chart background color
          <div className="color-row">
            <input
              type="color"
              id="chart-background-color"
              name="chart-background-color"
              value={selection.chartBackgroundColor || '#ffffff'}
              onChange={(event) => selection.onChartBackgroundColorChange(event.target.value)}
            />
            <button
              type="button"
              className="secondary"
              onClick={selection.onClearChartBackgroundColor}
            >
              Clear
            </button>
          </div>
          <div className="hint">Applies to the chart background circle.</div>
        </label>
        <label className="field" htmlFor="selection-color">
          Selected element color
          <div className="color-row">
            <input
              type="color"
              id="selection-color"
              name="selection-color"
              value={selection.selectionColor || '#000000'}
              onChange={(event) => selection.onColorChange(event.target.value)}
              disabled={!selection.selectionEnabled}
            />
            <button
              type="button"
              className="secondary"
              onClick={selection.onClearColor}
              disabled={!selection.selectionEnabled}
            >
              Clear color
            </button>
          </div>
          {selection.selectionColorMixed ? <div className="hint">Mixed colors</div> : null}
        </label>
        <label className="field checkbox" htmlFor="radial-move">
          Constrain drag to radial
          <input
            type="checkbox"
            id="radial-move"
            name="radial-move"
            checked={selection.radialMoveEnabled}
            onChange={(event) => selection.onRadialMoveEnabledChange(event.target.checked)}
            disabled={!selection.selectionEnabled}
          />
        </label>
        <div className="selection">{selection.selectedElement || 'None'}</div>
      </CollapsibleSection>

      <CollapsibleSection title="Frame mask" persistKey="design-frame-mask">
        <div className="field">
          <button
            type="button"
            className="secondary"
            onClick={selection.onFrameMaskActivate}
            title="Turn on frame mask to make frame transparent inside the guide circle."
          >
            Frame mask
          </button>
          <div className="hint">
            Turn on frame mask to make frame transparent inside the guide circle.
          </div>
        </div>
        <label className="field" htmlFor="frame-mask-cutoff">
          Frame mask cutoff
          <input
            type="range"
            id="frame-mask-cutoff"
            name="frame-mask-cutoff"
            min={150}
            max={255}
            step={1}
            value={selection.frameMaskCutoff}
            onChange={(event) => selection.onFrameMaskCutoffChange(Number(event.target.value))}
            disabled={!selection.frameMaskEnabled}
          />
          <div className="hint">{selection.frameMaskCutoff}</div>
        </label>
        <label className="field" htmlFor="frame-mask-offwhite">
          Offwhite tolerance
          <input
            type="range"
            id="frame-mask-offwhite"
            name="frame-mask-offwhite"
            min={0}
            max={100}
            step={1}
            value={selection.frameMaskOffwhiteBoost}
            onChange={(event) =>
              selection.onFrameMaskOffwhiteBoostChange(Number(event.target.value))
            }
            disabled={!selection.frameMaskEnabled}
          />
          <div className="hint">{selection.frameMaskOffwhiteBoost}</div>
        </label>
        <label className="field checkbox" htmlFor="frame-mask-guide">
          Show mask guide
          <input
            type="checkbox"
            id="frame-mask-guide"
            name="frame-mask-guide"
            checked={selection.frameMaskGuideVisible}
            onChange={(event) => selection.onFrameMaskGuideVisibleChange(event.target.checked)}
            disabled={!selection.frameMaskEnabled}
          />
        </label>
        <label className="field checkbox" htmlFor="frame-mask-lock-aspect">
          Lock mask aspect ratio
          <input
            type="checkbox"
            id="frame-mask-lock-aspect"
            name="frame-mask-lock-aspect"
            checked={selection.frameMaskLockAspect}
            onChange={(event) => selection.onFrameMaskLockAspectChange(event.target.checked)}
            disabled={!selection.frameMaskEnabled}
          />
        </label>
        <button
          type="button"
          className="secondary"
          onClick={selection.onSnapFrameMask}
          disabled={!selection.frameMaskEnabled}
        >
          Snap to frame hole
        </button>
        <button
          type="button"
          className="secondary"
          onClick={selection.onClearFrameMask}
          disabled={!selection.frameMaskEnabled}
        >
          Clear frame mask
        </button>
      </CollapsibleSection>
    </>
  )
}

export default DesignSection
