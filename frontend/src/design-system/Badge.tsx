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
        return { backgroundColor: 'rgba(242, 97, 156, 0.20)', color: '#FFB3D1', border: '1px solid rgba(242, 97, 156, 0.40)' };
      case 'lilac':
        return { backgroundColor: 'rgba(231, 190, 248, 0.20)', color: '#F3D5FC', border: '1px solid rgba(231, 190, 248, 0.40)' };
      case 'blueberry':
        return { backgroundColor: 'rgba(147, 171, 217, 0.20)', color: '#BFD0EF', border: '1px solid rgba(147, 171, 217, 0.40)' };
      case 'lemon':
        return { backgroundColor: 'rgba(237, 233, 134, 0.20)', color: '#F9F7A8', border: '1px solid rgba(237, 233, 134, 0.40)' };
      case 'success':
        return { backgroundColor: 'rgba(52, 211, 153, 0.20)', color: '#6EE7B7', border: '1px solid rgba(52, 211, 153, 0.40)' };
      case 'warning':
        return { backgroundColor: 'rgba(251, 191, 36, 0.20)', color: '#FCD34D', border: '1px solid rgba(251, 191, 36, 0.40)' };
      case 'danger':
        return { backgroundColor: 'rgba(248, 113, 113, 0.20)', color: '#FCA5A5', border: '1px solid rgba(248, 113, 113, 0.40)' };
      case 'neutral':
      default:
        return { backgroundColor: 'rgba(255, 255, 255, 0.08)', color: 'rgba(254, 243, 199, 0.85)', border: '1px solid rgba(255, 255, 255, 0.15)' };
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
