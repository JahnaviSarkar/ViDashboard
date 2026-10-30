import React from 'react';

export interface SliderProps {
  label?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  helperText?: string;
}

export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = '%',
  onChange,
  helperText,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {label && (
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#292633' }}>
            {label}
          </span>
        )}
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 800,
            padding: '2px 10px',
            backgroundColor: '#FDE8F1',
            color: '#B82869',
            borderRadius: 'var(--radius-pill)',
            fontFamily: 'var(--font-mono)',
            border: '1px solid #F9A8CE',
          }}
        >
          {value}{unit}
        </span>
      </div>

      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: '#F2619C',
          cursor: 'pointer',
          height: '6px',
          borderRadius: 'var(--radius-pill)',
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#77717F' }}>
        <span>{min}{unit}</span>
        {helperText && <span>{helperText}</span>}
        <span>{max}{unit}</span>
      </div>
    </div>
  );
};
