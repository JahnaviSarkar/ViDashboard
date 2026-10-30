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
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          {label}
        </label>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'var(--bg-input)',
          border: `1px solid ${errorMessage ? 'var(--danger)' : 'var(--border-strong)'}`,
          borderRadius: 'var(--radius-md)',
          padding: '0 12px',
          transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {leftIcon && (
          <span style={{ color: 'var(--text-muted)', display: 'flex', marginRight: '8px' }}>
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
            padding: '10px 0',
            fontSize: '0.9375rem',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            ...style,
          }}
          className={className}
          {...props}
        />
        {rightIcon && (
          <span style={{ color: 'var(--text-muted)', display: 'flex', marginLeft: '8px' }}>
            {rightIcon}
          </span>
        )}
      </div>

      {errorMessage ? (
        <span style={{ fontSize: '0.8125rem', color: 'var(--danger)', fontWeight: 500 }}>
          {errorMessage}
        </span>
      ) : helperText ? (
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
          {helperText}
        </span>
      ) : null}
    </div>
  );
};
