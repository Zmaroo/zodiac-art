import CollapsibleSection from '../CollapsibleSection'

type SelectionSectionProps = {
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
  radialMoveEnabled: boolean
  onRadialMoveEnabledChange: (value: boolean) => void
  glyphGlow: boolean
  onGlyphGlowChange: (value: boolean) => void
  glyphOutlineEnabled: boolean
  onGlyphOutlineEnabledChange: (value: boolean) => void
  glyphOutlineColor: string
  onGlyphOutlineColorChange: (value: string) => void
  frameMaskCutoff: number
  onFrameMaskCutoffChange: (value: number) => void
}

function SelectionSection({
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
  radialMoveEnabled,
  onRadialMoveEnabledChange,
  glyphGlow,
  onGlyphGlowChange,
  glyphOutlineEnabled,
  onGlyphOutlineEnabledChange,
  glyphOutlineColor,
  onGlyphOutlineColorChange,
  frameMaskCutoff,
  onFrameMaskCutoffChange,
}: SelectionSectionProps) {
  const palette = [
    '#111111',
    '#4a3320',
    '#8a5a2b',
    '#d9730d',
    '#c7392d',
    '#2d6a4f',
    '#3b5bdb',
    '#6f42c1',
    '#ffffff',
  ]
  return (
    <CollapsibleSection title="Selection" persistKey="selection">
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
      <div className="palette">
        {palette.map((color) => (
          <button
            key={color}
            type="button"
            className="swatch"
            style={{ backgroundColor: color }}
            onClick={() => onColorChange(color)}
            disabled={!selectionEnabled}
            aria-label={`Set color ${color}`}
            title={color}
          />
        ))}
      </div>
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
      <label className="field checkbox">
        Glow glyphs
        <input
          type="checkbox"
          checked={glyphGlow}
          onChange={(event) => onGlyphGlowChange(event.target.checked)}
        />
      </label>
      <label className="field checkbox">
        Outline glyphs
        <input
          type="checkbox"
          checked={glyphOutlineEnabled}
          onChange={(event) => onGlyphOutlineEnabledChange(event.target.checked)}
        />
      </label>
      <label className="field">
        Outline color
        <div className="color-row">
          <input
            type="color"
            value={glyphOutlineColor}
            onChange={(event) => onGlyphOutlineColorChange(event.target.value)}
            disabled={!glyphOutlineEnabled}
          />
          <button
            type="button"
            className="secondary"
            onClick={() => onGlyphOutlineColorChange('#ffffff')}
            disabled={!glyphOutlineEnabled}
          >
            Reset
          </button>
        </div>
      </label>
      <div className="palette">
        {palette.map((color) => (
          <button
            key={`outline-${color}`}
            type="button"
            className="swatch"
            style={{ backgroundColor: color }}
            onClick={() => onGlyphOutlineColorChange(color)}
            disabled={!glyphOutlineEnabled}
            aria-label={`Set outline color ${color}`}
            title={color}
          />
        ))}
      </div>
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
    </CollapsibleSection>
  )
}

export default SelectionSection
