type NumberFieldProps = {
  label: string
  value: number
  step?: number
  onChange: (value: number) => void
}

function NumberField({ label, value, step = 1, onChange }: NumberFieldProps) {
  return (
    <label className="field">
      {label}
      <input
        type="number"
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

export default NumberField
