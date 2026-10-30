import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { SourceRun } from '../../types';

export interface ShortfallBannerProps {
  sourceRuns: SourceRun[];
  onRetry?: () => void;
}

export const ShortfallBanner: React.FC<ShortfallBannerProps> = ({ sourceRuns, onRetry }) => {
  const shortfalls = sourceRuns.filter((r) => r.shortfall > 0);
  if (shortfalls.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        padding: '12px 18px',
        backgroundColor: '#FEF3C7',
        border: '1.5px solid #FCD34D',
        borderRadius: 'var(--radius-card)',
        color: '#92400E',
        fontSize: '0.8125rem',
        marginBottom: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
          <AlertCircle size={18} color="#D97706" />
          <span>Honest Collection Shortfall Accounting:</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: '#FFFFFF',
              border: '1px solid #FCD34D',
              borderRadius: 'var(--radius-pill)',
              padding: '4px 12px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: '#92400E',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <RefreshCw size={12} /> Retry Expansion
          </button>
        )}
      </div>

      <ul style={{ margin: 0, paddingLeft: '24px', lineHeight: 1.5 }}>
        {shortfalls.map((run) => (
          <li key={run.id || run.source}>
            <strong>{run.source === 'instagram' ? 'Instagram Reels' : 'Meta Ad Library'}:</strong>{' '}
            {run.usable} / 20 collected (shortfall: {run.shortfall}).{' '}
            <span style={{ fontStyle: 'italic', opacity: 0.9 }}>
              Reason: {run.error || (run.source === 'meta' ? 'Commercial video ads restricted for target region or keyword density' : 'Hashtag video feed rate-limited or exhausted')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

