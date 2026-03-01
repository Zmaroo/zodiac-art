import { useId } from 'react'

type NumberFieldProps = {
  label: string
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (value: number) => void
}

function NumberField({ label, value, step = 1, min, max, onChange }: NumberFieldProps) {
  const id = useId()
  const name = `number-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  const hasSlider = min !== undefined && max !== undefined

  return (
    <label className="field" htmlFor={id}>
      {label}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {hasSlider && (
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={Number.isFinite(value) ? value : 0}
            onChange={(event) => onChange(Number(event.target.value))}
            style={{ flex: 1 }}
          />
        )}
        <input
          type="number"
          id={id}
          name={name}
          step={step}
          min={min}
          max={max}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
          style={hasSlider ? { width: '80px' } : { width: '100%' }}
        />
      </div>
    </label>
  )
}

export default NumberField
