import CollapsibleSection from '../CollapsibleSection'
import type { FrameEntry } from '../../types'

type FramesSectionProps = {
  frameSearch: string
  onFrameSearchChange: (value: string) => void
  selectedId: string
  onSelectedIdChange: (value: string) => void
  filteredFrames: FrameEntry[]
  chartOnlyId: string
  selectedFrameSizeLabel: string
  onDeleteFrame: (frameIdToDelete: string) => void
  onClearMessages: () => void
}

function FramesSection({
  frameSearch,
  onFrameSearchChange,
  selectedId,
  onSelectedIdChange,
  filteredFrames,
  chartOnlyId,
  selectedFrameSizeLabel,
  onDeleteFrame,
  onClearMessages,
}: FramesSectionProps) {
  return (
    <CollapsibleSection title="Frames" persistKey="frames" onToggle={onClearMessages}>
      <label className="field" htmlFor="frame-search">
        Search frames
        <input
          type="text"
          id="frame-search"
          name="frame-search"
          value={frameSearch}
          onChange={(event) => onFrameSearchChange(event.target.value)}
          placeholder="Name or tag..."
        />
      </label>
      <select
        name="frame-select"
        aria-label="Select frame"
        value={selectedId}
        onChange={(event) => onSelectedIdChange(event.target.value)}
        className="frame-select"
      >
        <option value={chartOnlyId}>Chart only</option>
        {filteredFrames.map((frame) => (
          <option key={frame.id} value={frame.id}>
            {frame.name}
          </option>
        ))}
      </select>
      {selectedFrameSizeLabel ? (
        <div className="frame-size-label">Pixel size: {selectedFrameSizeLabel}</div>
      ) : null}
      {import.meta.env.DEV ? (
        <button
          type="button"
          className="secondary danger"
          disabled={!selectedId || selectedId === chartOnlyId}
          onClick={() => {
            if (!selectedId || selectedId === chartOnlyId) {
              return
            }
            if (!window.confirm('Delete this frame? This cannot be undone.')) {
              return
            }
            onDeleteFrame(selectedId)
          }}
        >
          Delete frame
        </button>
      ) : null}
    </CollapsibleSection>
  )
}

export default FramesSection
