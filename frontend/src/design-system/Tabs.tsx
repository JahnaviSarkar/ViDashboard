import React from 'react';

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

export interface TabsProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (id: string) => void;
  variant?: 'pill' | 'underline';
}

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onChange,
  variant = 'pill',
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: variant === 'pill' ? '4px' : '0',
        backgroundColor: variant === 'pill' ? 'var(--bg-subtle)' : 'transparent',
        borderRadius: 'var(--radius-lg)',
        gap: '4px',
        borderBottom: variant === 'underline' ? '1px solid var(--border-subtle)' : 'none',
        width: '100%',
        maxWidth: 'fit-content',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: variant === 'pill' ? '8px 16px' : '10px 18px',
              border: 'none',
              borderRadius: variant === 'pill' ? 'var(--radius-md)' : '0',
              borderBottom: variant === 'underline' && isActive ? '2px solid var(--primary)' : '2px solid transparent',
              backgroundColor: variant === 'pill' && isActive ? 'var(--bg-card)' : 'transparent',
              color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: isActive ? 700 : 500,
              fontSize: '0.875rem',
              cursor: 'pointer',
              boxShadow: variant === 'pill' && isActive ? 'var(--shadow-sm)' : 'none',
              transition: 'all 0.15s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '1px 6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: isActive ? 'var(--primary-subtle)' : 'var(--border-subtle)',
                  color: isActive ? 'var(--primary-text)' : 'var(--text-muted)',
                  fontWeight: 600,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
