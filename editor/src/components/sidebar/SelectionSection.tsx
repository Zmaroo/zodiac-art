import CollapsibleSection from '../CollapsibleSection'
import type { ActiveSelectionLayer } from '../../types'

type SelectionSectionProps = {
  wrapInSection?: boolean
  selectedElement: string
  selectableGroups: { label: string; items: { id: string; label: string }[] }[]
  onSelectedElementChange: (value: string) => void
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
  onFrameMaskEnabledChange: (value: boolean) => void
  activeSelectionLayer: ActiveSelectionLayer
  onActiveSelectionLayerChange: (value: ActiveSelectionLayer) => void
  frameMaskGuideVisible: boolean
  onFrameMaskGuideVisibleChange: (value: boolean) => void
  frameMaskLockAspect: boolean
  onFrameMaskLockAspectChange: (value: boolean) => void
  onSnapFrameMask: () => void
  onClearFrameMask: () => void
}

function SelectionSection({
  wrapInSection = true,
  selectedElement,
  selectableGroups,
  onSelectedElementChange,
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
  frameMaskOffwhiteBoost,
  onFrameMaskOffwhiteBoostChange,
  frameMaskEnabled,
  onFrameMaskEnabledChange,
  activeSelectionLayer,
  onActiveSelectionLayerChange,
  frameMaskGuideVisible,
  onFrameMaskGuideVisibleChange,
  frameMaskLockAspect,
  onFrameMaskLockAspectChange,
  onSnapFrameMask,
  onClearFrameMask,
}: SelectionSectionProps) {
  const content = (
    <>
      <label className="field" htmlFor="selection-element">
        Select element
        <select
          id="selection-element"
          name="selection-element"
          value={selectedElement}
          onChange={(event) => onSelectedElementChange(event.target.value)}
        >
          <option value="">None</option>
          {selectableGroups.map((group) => (
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
            value={chartLinesColor || '#000000'}
            onChange={(event) => onChartLinesColorChange(event.target.value)}
          />
          <button type="button" className="secondary" onClick={onClearChartLinesColor}>
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
            value={chartBackgroundColor || '#ffffff'}
            onChange={(event) => onChartBackgroundColorChange(event.target.value)}
          />
          <button type="button" className="secondary" onClick={onClearChartBackgroundColor}>
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
            value={selectionColor || '#000000'}
            onChange={(event) => onColorChange(event.target.value)}
            disabled={!selectionEnabled}
          />
          <button type="button" className="secondary" onClick={onClearColor} disabled={!selectionEnabled}>
            Clear color
          </button>
        </div>
        {selectionColorMixed ? <div className="hint">Mixed colors</div> : null}
      </label>
      <label className="field checkbox" htmlFor="radial-move">
        Constrain drag to radial
        <input
          type="checkbox"
          id="radial-move"
          name="radial-move"
          checked={radialMoveEnabled}
          onChange={(event) => onRadialMoveEnabledChange(event.target.checked)}
          disabled={!selectionEnabled}
        />
      </label>
      <label className="field checkbox" htmlFor="frame-mask-enabled">
        Enable frame mask
        <input
          type="checkbox"
          id="frame-mask-enabled"
          name="frame-mask-enabled"
          checked={frameMaskEnabled}
          onChange={(event) => onFrameMaskEnabledChange(event.target.checked)}
        />
      </label>
      <label className="field" htmlFor="frame-mask-cutoff">
        Frame mask cutoff
        <input
          type="range"
          id="frame-mask-cutoff"
          name="frame-mask-cutoff"
          min={150}
          max={255}
          step={1}
          value={frameMaskCutoff}
          onChange={(event) => onFrameMaskCutoffChange(Number(event.target.value))}
          disabled={!frameMaskEnabled}
        />
        <div className="hint">{frameMaskCutoff}</div>
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
          value={frameMaskOffwhiteBoost}
          onChange={(event) => onFrameMaskOffwhiteBoostChange(Number(event.target.value))}
          disabled={!frameMaskEnabled}
        />
        <div className="hint">{frameMaskOffwhiteBoost}</div>
      </label>
      <label className="field checkbox" htmlFor="frame-mask-edit">
        Edit frame mask
        <input
          type="checkbox"
          id="frame-mask-edit"
          name="frame-mask-edit"
          checked={activeSelectionLayer === 'frame_mask'}
          onChange={(event) =>
            onActiveSelectionLayerChange(event.target.checked ? 'frame_mask' : 'auto')
          }
          disabled={!frameMaskEnabled}
        />
      </label>
      <label className="field checkbox" htmlFor="frame-mask-guide">
        Show mask guide
        <input
          type="checkbox"
          id="frame-mask-guide"
          name="frame-mask-guide"
          checked={frameMaskGuideVisible}
          onChange={(event) => onFrameMaskGuideVisibleChange(event.target.checked)}
          disabled={!frameMaskEnabled}
        />
      </label>
      <label className="field checkbox" htmlFor="frame-mask-lock-aspect">
        Lock mask aspect ratio
        <input
          type="checkbox"
          id="frame-mask-lock-aspect"
          name="frame-mask-lock-aspect"
          checked={frameMaskLockAspect}
          onChange={(event) => onFrameMaskLockAspectChange(event.target.checked)}
          disabled={!frameMaskEnabled}
        />
      </label>
      <button type="button" className="secondary" onClick={onSnapFrameMask} disabled={!frameMaskEnabled}>
        Snap to frame hole
      </button>
      <button type="button" className="secondary" onClick={onClearFrameMask} disabled={!frameMaskEnabled}>
        Clear frame mask
      </button>
      <div className="selection">{selectedElement || 'None'}</div>
    </>
  )

  if (!wrapInSection) {
    return content
  }

  return (
    <CollapsibleSection title="Selection" persistKey="selection">
      {content}
    </CollapsibleSection>
  )
}

export default SelectionSection
