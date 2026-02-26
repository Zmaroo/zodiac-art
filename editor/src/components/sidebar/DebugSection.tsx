import CollapsibleSection from '../CollapsibleSection'

type DebugSectionProps = {
  showFrameCircle: boolean
  onShowFrameCircleChange: (value: boolean) => void
  debugItems: { label: string; value: string }[]
}

function DebugSection({ showFrameCircle, onShowFrameCircleChange, debugItems }: DebugSectionProps) {
  const items = debugItems.filter((item) => item.value)
  return (
    <CollapsibleSection title="Debug" initialOpen={false} persistKey="debug">
      <label className="field checkbox" htmlFor="debug-show-frame-circle">
        <span>Show frame circle</span>
        <input
          type="checkbox"
          id="debug-show-frame-circle"
          name="debug-show-frame-circle"
          checked={showFrameCircle}
          onChange={(event) => onShowFrameCircleChange(event.target.checked)}
        />
      </label>
      <div className="debug-list">
        {items.length === 0 ? (
          <div className="hint">No messages</div>
        ) : (
          items.map((item) => (
            <div key={item.label} className="debug-row">
              <span className="debug-label">{item.label}</span>
              <span className="debug-value">{item.value}</span>
            </div>
          ))
        )}
      </div>
    </CollapsibleSection>
  )
}

export default DebugSection
