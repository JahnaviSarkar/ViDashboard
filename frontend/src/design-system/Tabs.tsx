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
  variant: _variant = 'pill',
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px',
        backgroundColor: '#F5F2F7',
        borderRadius: 'var(--radius-pill)',
        gap: '4px',
        border: '1px solid #E9E3ED',
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
              gap: '6px',
              padding: '6px 16px',
              border: 'none',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: isActive ? '#FFFFFF' : 'transparent',
              color: isActive ? '#292633' : '#77717F',
              fontWeight: isActive ? 800 : 600,
              fontSize: '0.8125rem',
              cursor: 'pointer',
              boxShadow: isActive ? '0 2px 8px rgba(147, 171, 217, 0.15)' : 'none',
              transition: 'all 0.15s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && (
              <span
                style={{
                  fontSize: '0.6875rem',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-pill)',
                  backgroundColor: isActive ? '#E7BEF8' : '#E9E3ED',
                  color: isActive ? '#6B2B85' : '#77717F',
                  fontWeight: 700,
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
