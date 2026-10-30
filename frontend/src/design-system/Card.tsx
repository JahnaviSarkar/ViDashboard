import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  border?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  hoverable = false,
  padding = 'md',
  border = true,
  style,
  className = '',
  ...props
}) => {
  const getPadding = () => {
    switch (padding) {
      case 'none': return '0';
      case 'sm': return '12px';
      case 'lg': return '28px';
      case 'md':
      default: return '20px';
    }
  };

  const baseStyles: React.CSSProperties = {
    backgroundColor: 'var(--bg-card, rgba(255, 255, 255, 0.06))',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderRadius: 'var(--radius-card, 20px)',
    border: border ? '1px solid var(--border-card, rgba(255, 255, 255, 0.12))' : 'none',
    boxShadow: 'var(--shadow-card, 0 8px 32px rgba(0, 0, 0, 0.25))',
    padding: getPadding(),
    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    position: 'relative',
    overflow: 'hidden',
    ...style,
  };

  return (
    <div
      style={baseStyles}
      className={`card ${hoverable ? 'card-hoverable' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
