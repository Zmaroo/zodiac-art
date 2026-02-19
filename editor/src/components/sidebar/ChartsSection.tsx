import CollapsibleSection from '../CollapsibleSection'
import type { ChartListItem } from '../../types'

type ChartsSectionProps = {
  charts: ChartListItem[]
  chartId: string
  onSelectChart: (chartId: string) => void
  onChartIdChange: (value: string) => void
  onClearMessages: () => void
}

function ChartsSection({
  charts,
  chartId,
  onSelectChart,
  onChartIdChange,
  onClearMessages,
}: ChartsSectionProps) {
  return (
    <CollapsibleSection title="My Charts" persistKey="my-charts" onToggle={onClearMessages}>
      {charts.length === 0 ? (
        <div className="hint">No charts yet.</div>
      ) : (
        <select
          value={chartId}
          onChange={(event) => {
            if (event.target.value) {
              onSelectChart(event.target.value)
            }
          }}
          className="chart-select"
        >
          <option value="">Select a chart...</option>
          {charts.map((chart) => (
            <option key={chart.chart_id} value={chart.chart_id}>
              {chart.name || chart.chart_id} ({chart.created_at})
            </option>
          ))}
        </select>
      )}
      <label className="field">
        Chart ID
        <input
          type="text"
          value={chartId}
          onChange={(event) => onChartIdChange(event.target.value)}
          placeholder="Paste chart id"
          style={{ marginTop: '8px' }}
        />
      </label>
    </CollapsibleSection>
  )
}

export default ChartsSection
