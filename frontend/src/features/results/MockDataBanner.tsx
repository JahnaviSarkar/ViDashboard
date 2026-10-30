import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface MockDataBannerProps {
  isMock?: boolean;
}

export const MockDataBanner: React.FC<MockDataBannerProps> = ({ isMock }) => {
  if (!isMock) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '10px 18px',
        backgroundColor: '#FCFBE8',
        border: '1.5px solid #EDE986',
        borderRadius: 'var(--radius-card)',
        color: '#6E6B15',
        fontSize: '0.8125rem',
        fontWeight: 700,
        boxShadow: '0 2px 8px rgba(237, 233, 134, 0.25)',
        marginBottom: '16px',
      }}
    >
      <AlertTriangle size={18} color="#D97706" style={{ flexShrink: 0 }} />
      <span>
        ⚡ <strong>MOCK DATA BANNER:</strong> Displaying simulated candidate video items (MODE=mock). Set <code>MODE=live</code> in <code>.env</code> with real API keys for production platform collection.
      </span>
    </div>
  );
};

