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
    backgroundColor: '#FFFFFF',
    borderRadius: 'var(--radius-card)',
    border: border ? '1px solid #E9E3ED' : 'none',
    boxShadow: 'var(--shadow-card)',
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
