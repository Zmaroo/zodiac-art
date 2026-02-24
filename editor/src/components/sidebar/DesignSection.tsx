import { useState, type ChangeEvent } from 'react'
import CollapsibleSection from '../CollapsibleSection'
import NumberField from '../NumberField'
import SelectionSection from './SelectionSection'
import type { ActiveSelectionLayer, ChartFit, DesignSettings, LayerOrderKey } from '../../types'

type DesignSectionProps = {
  chartFit: ChartFit
  onChartFitChange: (next: ChartFit) => void
  design: DesignSettings
  onLayerOrderChange: (value: LayerOrderKey[]) => void
  onLayerOpacityChange: (layer: LayerOrderKey, value: number) => void
  hasFrame: boolean
  hasChartBackground: boolean
  hasBackgroundImage: boolean
  backgroundImagePath: string | null
  backgroundImageUrl: string
  backgroundImageError: string
  backgroundImageStatus: string
  backgroundImageUploading: boolean
  onBackgroundImageUpload: (file: File | null) => void
  onBackgroundImageClear: () => void
  backgroundImageScale: number
  backgroundImageDx: number
  backgroundImageDy: number
  onBackgroundImageScaleChange: (value: number) => void
  onBackgroundImageDxChange: (value: number) => void
  onBackgroundImageDyChange: (value: number) => void
  onSignGlyphScaleChange: (value: number) => void
  onPlanetGlyphScaleChange: (value: number) => void
  onInnerRingScaleChange: (value: number) => void
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
  onChartFitChange,
  design,
  onLayerOrderChange,
  onLayerOpacityChange,
  hasFrame,
  hasChartBackground,
  hasBackgroundImage,
  backgroundImagePath,
  backgroundImageUrl,
  backgroundImageError,
  backgroundImageStatus,
  backgroundImageUploading,
  onBackgroundImageUpload,
  onBackgroundImageClear,
  backgroundImageScale,
  backgroundImageDx,
  backgroundImageDy,
  onBackgroundImageScaleChange,
  onBackgroundImageDxChange,
  onBackgroundImageDyChange,
  onSignGlyphScaleChange,
  onPlanetGlyphScaleChange,
  onInnerRingScaleChange,
  selectedElement,
  selectableGroups,
  onSelectedElementChange,
  activeSelectionLayer,
  onActiveSelectionLayerChange,
  selectionColor,
  selectionColorMixed,
  selectionEnabled,
  onColorChange,
  onClearColor,
  chartLinesColor,
  onChartLinesColorChange,
  onClearChartLinesColor,
  chartBackgroundColor,
  onChartBackgroundColorChange,
  onClearChartBackgroundColor,
  radialMoveEnabled,
  onRadialMoveEnabledChange,
  frameMaskCutoff,
  onFrameMaskCutoffChange,
}: DesignSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(
    () => localStorage.getItem('zodiac_editor.designAdvanced') === 'true'
  )
  const isLayerVisible = (layerKey: LayerOrderKey) => {
    if (layerKey === 'chart') {
      return true
    }
    if (layerKey === 'background') {
      return hasChartBackground
    }
    if (layerKey === 'frame') {
      return hasFrame
    }
    if (layerKey === 'chart_background_image') {
      return hasBackgroundImage
    }
    return true
  }

  const visibleLayerOrder = design.layer_order.filter(isLayerVisible)

  const moveLayer = (order: LayerOrderKey[], index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= order.length) {
      return
    }
    const layerId = order[index]
    const swapId = order[target]
    const next = [...design.layer_order]
    const fromIndex = next.indexOf(layerId)
    const toIndex = next.indexOf(swapId)
    if (fromIndex < 0 || toIndex < 0) {
      return
    }
    next[fromIndex] = swapId
    next[toIndex] = layerId
    onLayerOrderChange(next)
  }
  const handleBackgroundImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    onBackgroundImageUpload(file)
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
          disabled={backgroundImageUploading}
        />
      </label>
      {backgroundImagePath ? (
        <div className="layer-image-preview">
          {backgroundImageUrl ? (
            <img src={backgroundImageUrl} alt="Chart background" />
          ) : null}
          <button type="button" className="secondary" onClick={onBackgroundImageClear}>
            Remove image
          </button>
        </div>
      ) : (
        <div className="hint">No background image uploaded.</div>
      )}
      {backgroundImageError ? <div className="inline-error">{backgroundImageError}</div> : null}
      {backgroundImageStatus ? (
        <div className="inline-status">{backgroundImageStatus}</div>
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
            value={backgroundImageScale}
            step={0.05}
            onChange={onBackgroundImageScaleChange}
          />
          <NumberField
            label="x"
            value={backgroundImageDx}
            step={1}
            onChange={onBackgroundImageDxChange}
          />
          <NumberField
            label="y"
            value={backgroundImageDy}
            step={1}
            onChange={onBackgroundImageDyChange}
          />
          <div className="subsection-title">Chart Fit</div>
          <NumberField
            label="dx"
            value={chartFit.dx}
            onChange={(value) => onChartFitChange({ ...chartFit, dx: value })}
          />
          <NumberField
            label="dy"
            value={chartFit.dy}
            onChange={(value) => onChartFitChange({ ...chartFit, dy: value })}
          />
          <NumberField
            label="scale"
            value={chartFit.scale}
            step={0.01}
            onChange={(value) => onChartFitChange({ ...chartFit, scale: value })}
          />
          <NumberField
            label="rotation"
            value={chartFit.rotation_deg}
            step={0.5}
            onChange={(value) =>
              onChartFitChange({ ...chartFit, rotation_deg: value })
            }
          />
          <div className="hint">Drag to move. Shift+drag to scale. Alt+drag to rotate.</div>
        </>
      ) : null}
      <div className="subsection-title">Layering (top → bottom)</div>
      <div className="layer-stack">
        {[...visibleLayerOrder].reverse().map((layerKey, index, order) => {
          const opacity = design.layer_opacity?.[layerKey] ?? 1
          const selectionId = LAYER_SELECTION_IDS[layerKey]
          const activeKey = LAYER_ACTIVE_KEYS[layerKey]
          const isActiveLayer = Boolean(activeKey && activeSelectionLayer === activeKey)
          const isSelected = Boolean(selectionId && selectionId === selectedElement)
          const handleLayerActivate = () => {
            if (!activeKey) {
              return
            }
            const next = activeSelectionLayer === activeKey ? 'auto' : activeKey
            onActiveSelectionLayerChange(next)
            if (selectionId && next !== 'auto') {
              onSelectedElementChange(selectionId)
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
                    onLayerOpacityChange(layerKey, Number(event.target.value))
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
          value={design.sign_glyph_scale}
          onChange={(event) => onSignGlyphScaleChange(Number(event.target.value))}
        />
        <div className="hint">{design.sign_glyph_scale.toFixed(2)}</div>
      </label>
      <label className="field">
        Planet glyph size
        <input
          type="range"
          min={0.7}
          max={1.3}
          step={0.01}
          value={design.planet_glyph_scale}
          onChange={(event) => onPlanetGlyphScaleChange(Number(event.target.value))}
        />
        <div className="hint">{design.planet_glyph_scale.toFixed(2)}</div>
      </label>
      <label className="field">
        Inner ring scale
        <input
          type="range"
          min={0.85}
          max={1.15}
          step={0.01}
          value={design.inner_ring_scale}
          onChange={(event) => onInnerRingScaleChange(Number(event.target.value))}
        />
        <div className="hint">{design.inner_ring_scale.toFixed(2)}</div>
      </label>
      <div className="subsection-title">Selection</div>
      <SelectionSection
        wrapInSection={false}
        selectedElement={selectedElement}
        selectableGroups={selectableGroups}
        onSelectedElementChange={onSelectedElementChange}
        selectionColor={selectionColor}
        selectionColorMixed={selectionColorMixed}
        selectionEnabled={selectionEnabled}
        onColorChange={onColorChange}
        onClearColor={onClearColor}
        chartLinesColor={chartLinesColor}
        onChartLinesColorChange={onChartLinesColorChange}
        onClearChartLinesColor={onClearChartLinesColor}
        chartBackgroundColor={chartBackgroundColor}
        onChartBackgroundColorChange={onChartBackgroundColorChange}
        onClearChartBackgroundColor={onClearChartBackgroundColor}
        radialMoveEnabled={radialMoveEnabled}
        onRadialMoveEnabledChange={onRadialMoveEnabledChange}
        frameMaskCutoff={frameMaskCutoff}
        onFrameMaskCutoffChange={onFrameMaskCutoffChange}
      />
    </CollapsibleSection>
  )
}

export default DesignSection
