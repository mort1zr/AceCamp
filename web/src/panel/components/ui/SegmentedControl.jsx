import { useId } from 'react'
import './ui.css'

/** Native radios provide arrow-key navigation and a single tab stop per group. */
export function SegmentedControl({ label, options, value, onChange, disabled = false, name }) {
  const id = useId()

  return (
    <fieldset className="ac-ui ac-segmented" disabled={disabled}>
      <legend className="ac-segmented__legend">{label}</legend>
      <div className="ac-segmented__options">
        {options.map(option => (
          <label className="ac-segmented__option" key={option.value}>
            <input
              type="radio"
              name={name ?? id}
              value={option.value}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
