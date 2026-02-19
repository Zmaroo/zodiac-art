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
        Color
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
      <div className="selection">{selectedElement || 'None'}</div>
    </CollapsibleSection>
  )
}

export default SelectionSection
