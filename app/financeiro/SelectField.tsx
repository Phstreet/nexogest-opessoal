"use client";

type SelectFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  helper?: string;
};

export default function SelectField({
  label,
  value,
  onChange,
  options,
  helper,
}: SelectFieldProps) {
  return (
    <div className="finance-field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {helper && <small className="finance-field-helper">{helper}</small>}
    </div>
  );
}
