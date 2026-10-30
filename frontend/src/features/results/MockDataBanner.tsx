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
        backgroundColor: 'rgba(237, 233, 134, 0.15)',
        border: '1.5px solid rgba(237, 233, 134, 0.35)',
        borderRadius: 'var(--radius-card)',
        color: '#FEF9C3',
        fontSize: '0.8125rem',
        fontWeight: 600,
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25)',
        marginBottom: '16px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <AlertTriangle size={18} color="#EDE986" style={{ flexShrink: 0 }} />
      <span>
        ⚡ <strong style={{ color: '#EDE986' }}>MOCK DATA BANNER:</strong> Displaying simulated candidate video items (MODE=mock). Set <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: '4px' }}>MODE=live</code> in <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '2px 5px', borderRadius: '4px' }}>.env</code> with real API keys for production platform collection.
      </span>
    </div>
  );
};

