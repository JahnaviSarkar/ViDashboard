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
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        border: '1.5px solid rgba(251, 191, 36, 0.40)',
        borderRadius: 'var(--radius-card)',
        color: '#FEF3C7',
        fontSize: '0.8125rem',
        marginBottom: '16px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 800 }}>
          <AlertCircle size={18} color="#FBBF24" />
          <span style={{ color: '#FDE68A' }}>Honest Collection Shortfall Accounting:</span>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              background: 'rgba(255, 255, 255, 0.12)',
              border: '1px solid rgba(251, 191, 36, 0.40)',
              borderRadius: 'var(--radius-pill)',
              padding: '4px 12px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.75rem',
              color: '#FDE68A',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <RefreshCw size={12} /> Retry Expansion
          </button>
        )}
      </div>

      <ul style={{ margin: 0, paddingLeft: '24px', lineHeight: 1.5, color: '#FEF3C7' }}>
        {shortfalls.map((run) => (
          <li key={run.id || run.source}>
            <strong style={{ color: '#FFFFFF' }}>{run.source === 'instagram' ? 'Instagram Reels' : 'Meta Ad Library'}:</strong>{' '}
            {run.usable} / 20 collected (shortfall: {run.shortfall}).{' '}
            <span style={{ fontStyle: 'italic', opacity: 0.85, color: 'rgba(254, 243, 199, 0.75)' }}>
              Reason: {run.error || (run.source === 'meta' ? 'Commercial video ads restricted for target region or keyword density' : 'Hashtag video feed rate-limited or exhausted')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

