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
  onClearMessages,
}: CreateChartSectionProps) {
  return (
    <CollapsibleSection title="Create Chart" persistKey="create-chart" onToggle={onClearMessages}>
      <label className="field">
        Name
        <input
          type="text"
          value={chartName}
          onChange={(event) => onChartNameChange(event.target.value)}
          placeholder="Chart name"
        />
      </label>
      <label className="field">
        Birth date
        <input
          type="date"
          value={birthDate}
          onChange={(event) => onBirthDateChange(event.target.value)}
        />
      </label>
      <label className="field">
        Birth time
        <input
          type="time"
          value={birthTime}
          onChange={(event) => onBirthTimeChange(event.target.value)}
        />
      </label>
      <NumberField label="Latitude" value={latitude} step={0.0001} onChange={onLatitudeChange} />
      <NumberField label="Longitude" value={longitude} step={0.0001} onChange={onLongitudeChange} />
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
    </CollapsibleSection>
  )
}

export default CreateChartSection
