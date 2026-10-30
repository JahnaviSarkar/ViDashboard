import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'raspberry' | 'lilac' | 'blueberry' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'raspberry',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  style,
  className = '',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'lilac':
        return {
          backgroundColor: '#E7BEF8',
          color: '#292633',
          border: '1px solid #D8A5EC',
        };
      case 'blueberry':
        return {
          backgroundColor: '#93ABD9',
          color: '#FFFFFF',
          border: '1px solid #7E98CB',
        };
      case 'secondary':
        return {
          backgroundColor: '#FFFFFF',
          color: '#292633',
          border: '1px solid #E9E3ED',
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: '#77717F',
          border: '1px solid transparent',
        };
      case 'danger':
        return {
          backgroundColor: '#EF4444',
          color: '#FFFFFF',
          border: '1px solid #DC2626',
        };
      case 'raspberry':
      default:
        return {
          backgroundColor: '#F2619C',
          color: '#FFFFFF',
          border: '1px solid #DE4F8B',
          boxShadow: '0 2px 10px rgba(242, 97, 156, 0.28)',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { padding: '6px 14px', fontSize: '0.8125rem' };
      case 'lg':
        return { padding: '12px 28px', fontSize: '1rem' };
      case 'md':
      default:
        return { padding: '9px 20px', fontSize: '0.875rem' };
    }
  };

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: 700,
    cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
    opacity: disabled || isLoading ? 0.65 : 1,
    transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
    fontFamily: 'var(--font-sans)',
    borderRadius: 'var(--radius-pill)',
    outline: 'none',
    userSelect: 'none',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  };

  return (
    <button
      disabled={disabled || isLoading}
      style={baseStyles}
      className={`btn-${variant} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 size={size === 'sm' ? 14 : 18} className="animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
