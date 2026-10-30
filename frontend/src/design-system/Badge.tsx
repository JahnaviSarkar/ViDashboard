import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'raspberry' | 'lilac' | 'blueberry' | 'lemon' | 'neutral' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  icon,
  style,
  className = '',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'raspberry':
        return { backgroundColor: '#FDE8F1', color: '#B82869', border: '1px solid #F9A8CE' };
      case 'lilac':
        return { backgroundColor: '#F8EEFC', color: '#6B2B85', border: '1px solid #E7BEF8' };
      case 'blueberry':
        return { backgroundColor: '#EBF1F9', color: '#314F85', border: '1px solid #93ABD9' };
      case 'lemon':
        return { backgroundColor: '#FCFBE8', color: '#6E6B15', border: '1px solid #EDE986' };
      case 'success':
        return { backgroundColor: '#D1FAE5', color: '#065F46', border: '1px solid #6EE7B7' };
      case 'warning':
        return { backgroundColor: '#FEF3C7', color: '#92400E', border: '1px solid #FCD34D' };
      case 'danger':
        return { backgroundColor: '#FEE2E2', color: '#991B1B', border: '1px solid #FCA5A5' };
      case 'neutral':
      default:
        return { backgroundColor: '#FAF8F7', color: '#77717F', border: '1px solid #E9E3ED' };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { padding: '2px 8px', fontSize: '0.75rem' };
      case 'md':
      default:
        return { padding: '4px 10px', fontSize: '0.8125rem' };
    }
  };

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: 600,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
    borderRadius: 'var(--radius-pill)',
    fontFamily: 'var(--font-sans)',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  };

  return (
    <span style={baseStyles} className={`badge ${className}`} {...props}>
      {icon}
      {children}
    </span>
  );
};
