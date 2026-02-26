import CollapsibleSection from '../CollapsibleSection'
import NumberField from '../NumberField'

type CreateChartSectionProps = {
  chartName: string
  birthDate: string
  birthTime: string
  latitude: number
  longitude: number
  onChartNameChange: (value: string) => void
  onBirthDateChange: (value: string) => void
  onBirthTimeChange: (value: string) => void
  onLatitudeChange: (value: number) => void
  onLongitudeChange: (value: number) => void
  onCreateChart: () => void
  onResetSession: () => void
  onFactoryReset: () => void
  onResetView: () => void
  onAutoFit: () => void
  onResetToSavedFit: () => void
  autoFitEnabled: boolean
  resetToSavedEnabled: boolean
  onClearMessages: () => void
}

function CreateChartSection({
  chartName,
  birthDate,
  birthTime,
  latitude,
  longitude,
  onChartNameChange,
  onBirthDateChange,
  onBirthTimeChange,
  onLatitudeChange,
  onLongitudeChange,
  onCreateChart,
  onResetSession,
  onFactoryReset,
  onResetView,
  onAutoFit,
  onResetToSavedFit,
  autoFitEnabled,
  resetToSavedEnabled,
  onClearMessages,
}: CreateChartSectionProps) {
  return (
    <CollapsibleSection title="Create Chart" persistKey="create-chart" onToggle={onClearMessages}>
      <label className="field" htmlFor="chart-name">
        Name
        <input
          type="text"
          id="chart-name"
          name="chart-name"
          value={chartName}
          onChange={(event) => onChartNameChange(event.target.value)}
          placeholder="Chart name"
        />
      </label>
      <label className="field" htmlFor="birth-date">
        Birth date
        <input
          type="date"
          id="birth-date"
          name="birth-date"
          value={birthDate}
          onChange={(event) => onBirthDateChange(event.target.value)}
        />
      </label>
      <label className="field" htmlFor="birth-time">
        Birth time
        <input
          type="time"
          id="birth-time"
          name="birth-time"
          value={birthTime}
          onChange={(event) => onBirthTimeChange(event.target.value)}
        />
      </label>
      <NumberField label="Latitude" value={latitude} step={0.0001} onChange={onLatitudeChange} />
      <NumberField label="Longitude" value={longitude} step={0.0001} onChange={onLongitudeChange} />
      <div className="button-grid">
        <button className="secondary" onClick={onCreateChart}>
          Create chart
        </button>
        <button
          className="secondary"
          onClick={onResetSession}
          title="Clears chart ID and birth inputs; resets fit/overrides for this session."
        >
          Clear Form
        </button>
        <button
          className="secondary"
          onClick={onFactoryReset}
          title="Clears all editor local storage and restores defaults."
        >
          Factory reset
        </button>
        <button
          className="secondary"
          onClick={onResetView}
          title="Reverts fit and label overrides to the initial loaded state."
        >
          Reset View
        </button>
        <button className="secondary" onClick={onAutoFit} disabled={!autoFitEnabled}>
          Re-auto-fit
        </button>
        <button
          className="secondary"
          onClick={onResetToSavedFit}
          disabled={!resetToSavedEnabled}
          title={resetToSavedEnabled ? '' : 'No saved fit available yet.'}
        >
          Reset to saved fit
        </button>
      </div>
    </CollapsibleSection>
  )
}

export default CreateChartSection
