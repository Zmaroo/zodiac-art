import CollapsibleSection from '../CollapsibleSection'
import type { FrameEntry } from '../../types'

type FramesSectionProps = {
  frameSearch: string
  onFrameSearchChange: (value: string) => void
  selectedId: string
  onSelectedIdChange: (value: string) => void
  filteredFrames: FrameEntry[]
  chartOnlyId: string
  onClearMessages: () => void
}

function FramesSection({
  frameSearch,
  onFrameSearchChange,
  selectedId,
  onSelectedIdChange,
  filteredFrames,
  chartOnlyId,
  onClearMessages,
}: FramesSectionProps) {
  return (
    <CollapsibleSection title="Frames" persistKey="frames" onToggle={onClearMessages}>
      <label className="field">
        Search frames
        <input
          type="text"
          value={frameSearch}
          onChange={(event) => onFrameSearchChange(event.target.value)}
          placeholder="Name or tag..."
        />
      </label>
      <select
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
    </CollapsibleSection>
  )
}

export default FramesSection
