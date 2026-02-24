import CollapsibleSection from '../CollapsibleSection'

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
  outlineColor: string
  onOutlineColorChange: (value: string) => void
  frameMaskCutoff: number
  onFrameMaskCutoffChange: (value: number) => void
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
  outlineColor,
  onOutlineColorChange,
  frameMaskCutoff,
  onFrameMaskCutoffChange,
}: SelectionSectionProps) {
  const content = (
    <>
      <label className="field">
        Select element
        <select
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
      <label className="field">
        Chart lines color
        <div className="color-row">
          <input
            type="color"
            value={chartLinesColor || '#000000'}
            onChange={(event) => onChartLinesColorChange(event.target.value)}
          />
          <button type="button" className="secondary" onClick={onClearChartLinesColor}>
            Reset
          </button>
        </div>
        <div className="hint">Applies to inner/outer rings + cusp lines.</div>
      </label>
      <label className="field">
        Chart background color
        <div className="color-row">
          <input
            type="color"
            value={chartBackgroundColor || '#ffffff'}
            onChange={(event) => onChartBackgroundColorChange(event.target.value)}
          />
          <button type="button" className="secondary" onClick={onClearChartBackgroundColor}>
            Clear
          </button>
        </div>
        <div className="hint">Applies to the chart background circle.</div>
      </label>
      <label className="field">
        Selected element color
        <div className="color-row">
          <input
            type="color"
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
      <label className="field checkbox">
        Constrain drag to radial
        <input
          type="checkbox"
          checked={radialMoveEnabled}
          onChange={(event) => onRadialMoveEnabledChange(event.target.checked)}
          disabled={!selectionEnabled}
        />
      </label>
      <label className="field">
        Selection outline color
        <div className="color-row">
          <input
            type="color"
            value={outlineColor}
            onChange={(event) => onOutlineColorChange(event.target.value)}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => onOutlineColorChange('#ffffff')}
          >
            Reset
          </button>
        </div>
      </label>
      <label className="field">
        Frame mask cutoff
        <input
          type="range"
          min={150}
          max={255}
          step={1}
          value={frameMaskCutoff}
          onChange={(event) => onFrameMaskCutoffChange(Number(event.target.value))}
        />
        <div className="hint">{frameMaskCutoff}</div>
      </label>
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
