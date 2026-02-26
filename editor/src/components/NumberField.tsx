import { useId } from 'react'

type NumberFieldProps = {
  label: string
  value: number
  step?: number
  onChange: (value: number) => void
}

function NumberField({ label, value, step = 1, onChange }: NumberFieldProps) {
  const id = useId()
  const name = `number-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return (
    <label className="field" htmlFor={id}>
      {label}
      <input
        type="number"
        id={id}
        name={name}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export default NumberField
