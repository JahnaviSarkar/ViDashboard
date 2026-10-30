import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'instagram' | 'meta' | 'frames' | 'thumbnail' | 'caption_only';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  icon,
  style,
  className = '',
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'success':
        return { backgroundColor: 'var(--success-subtle)', color: 'var(--success-text)', border: '1px solid var(--success)' };
      case 'warning':
        return { backgroundColor: 'var(--warning-subtle)', color: 'var(--warning-text)', border: '1px solid var(--warning)' };
      case 'danger':
        return { backgroundColor: 'var(--danger-subtle)', color: 'var(--danger-text)', border: '1px solid var(--danger)' };
      case 'info':
        return { backgroundColor: 'var(--info-subtle)', color: 'var(--info-text)', border: '1px solid var(--info)' };
      case 'instagram':
        return {
          background: 'var(--instagram-gradient)',
          color: '#ffffff',
          fontWeight: 700,
          border: 'none',
          boxShadow: '0 2px 4px rgba(225, 48, 108, 0.25)',
        };
      case 'meta':
        return { backgroundColor: 'var(--meta-blue-subtle)', color: 'var(--meta-blue)', border: '1px solid var(--meta-blue)', fontWeight: 700 };
      case 'frames':
        return { backgroundColor: 'var(--evidence-frames-subtle)', color: 'var(--evidence-frames)', border: '1px solid var(--evidence-frames)' };
      case 'thumbnail':
        return { backgroundColor: 'var(--evidence-thumbnail-subtle)', color: 'var(--evidence-thumbnail)', border: '1px solid var(--evidence-thumbnail)' };
      case 'caption_only':
        return { backgroundColor: 'var(--evidence-caption-subtle)', color: 'var(--evidence-caption)', border: '1px solid var(--evidence-caption)' };
      case 'default':
      default:
        return { backgroundColor: 'var(--bg-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { padding: '2px 8px', fontSize: '0.75rem', borderRadius: 'var(--radius-full)' };
      case 'md':
      default:
        return { padding: '4px 10px', fontSize: '0.8125rem', borderRadius: 'var(--radius-full)' };
    }
  };

  const baseStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontWeight: 600,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)',
    ...getVariantStyles(),
    ...getSizeStyles(),
    ...style,
  };

  return (
    <span style={baseStyles} className={`badge-${variant} ${className}`} {...props}>
      {icon}
      {children}
    </span>
  );
};
