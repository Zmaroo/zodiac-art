import CollapsibleSection from '../CollapsibleSection'
import NumberField from '../NumberField'
import type { ChartFit } from '../../types'

type ChartFitSectionProps = {
  chartFit: ChartFit
  onChartFitChange: (next: ChartFit) => void
}

function ChartFitSection({ chartFit, onChartFitChange }: ChartFitSectionProps) {
  return (
    <CollapsibleSection title="Chart Fit">
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
        onChange={(value) => onChartFitChange({ ...chartFit, rotation_deg: value })}
      />
      <div className="hint">Drag to move. Shift+drag to scale. Alt+drag to rotate.</div>
    </CollapsibleSection>
  )
}

export default ChartFitSection
