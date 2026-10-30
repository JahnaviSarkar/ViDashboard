import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  errorMessage?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  errorMessage,
  leftIcon,
  rightIcon,
  disabled,
  style,
  id,
  className = '',
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label
          htmlFor={inputId}
          style={{
            fontSize: '0.8125rem',
            fontWeight: 700,
            color: '#292633',
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          border: `1.5px solid ${errorMessage ? '#EF4444' : '#E9E3ED'}`,
          borderRadius: 'var(--radius-pill)',
          padding: '0 16px',
          boxShadow: '0 2px 8px rgba(147, 171, 217, 0.08)',
          transition: 'all 0.15s ease',
        }}
      >
        {leftIcon && (
          <span style={{ color: '#77717F', display: 'flex', marginRight: '10px' }}>
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          disabled={disabled}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            padding: '11px 0',
            fontSize: '0.9375rem',
            color: '#292633',
            fontFamily: 'var(--font-sans)',
            ...style,
          }}
          className={className}
          {...props}
        />
        {rightIcon && (
          <span style={{ color: '#77717F', display: 'flex', marginLeft: '10px' }}>
            {rightIcon}
          </span>
        )}
      </div>

      {errorMessage ? (
        <span style={{ fontSize: '0.8125rem', color: '#EF4444', fontWeight: 600 }}>
          {errorMessage}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: '0.75rem', color: '#77717F' }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
};
