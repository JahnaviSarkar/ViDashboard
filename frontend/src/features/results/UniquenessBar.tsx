import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Card } from '../../design-system';

export interface UniquenessBarProps {
  totalCollected: number;
  duplicatesRemoved: number;
  previouslySeenFiltered: number;
  uniqueRemaining: number;
  showPreviouslySeen: boolean;
  onToggleShowPreviouslySeen: () => void;
}

export const UniquenessBar: React.FC<UniquenessBarProps> = ({
  totalCollected,
  duplicatesRemoved,
  previouslySeenFiltered,
  uniqueRemaining,
  showPreviouslySeen,
  onToggleShowPreviouslySeen,
}) => {
  const total = Math.max(1, totalCollected || (uniqueRemaining + duplicatesRemoved + previouslySeenFiltered));
  const uniquePct = Math.round((uniqueRemaining / total) * 100);
  const dedupPct = Math.round((duplicatesRemoved / total) * 100);
  const seenPct = Math.round((previouslySeenFiltered / total) * 100);

  return (
    <Card padding="sm" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'rgba(254, 243, 199, 0.70)' }}>Raw Collected: </span>
            <strong style={{ color: '#FFFFFF' }}>{totalCollected}</strong>
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'rgba(254, 243, 199, 0.70)' }}>Duplicates Removed: </span>
            <strong style={{ color: '#E7BEF8' }}>-{duplicatesRemoved}</strong>
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'rgba(254, 243, 199, 0.70)' }}>Previously Seen Filtered: </span>
            <strong style={{ color: '#EDE986' }}>-{previouslySeenFiltered}</strong>
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: 'rgba(254, 243, 199, 0.70)' }}>New Unique: </span>
            <strong style={{ color: '#93ABD9' }}>{uniqueRemaining}</strong>
          </div>
        </div>

        {/* Show Previously Seen Toggle */}
        <button
          type="button"
          onClick={onToggleShowPreviouslySeen}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '5px 14px',
            borderRadius: 'var(--radius-pill)',
            border: showPreviouslySeen ? '1.5px solid #F2619C' : '1px solid rgba(255, 255, 255, 0.18)',
            backgroundColor: showPreviouslySeen ? 'rgba(242, 97, 156, 0.22)' : 'rgba(255, 255, 255, 0.08)',
            color: showPreviouslySeen ? '#F2619C' : '#FFFFFF',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            backdropFilter: 'blur(8px)',
          }}
        >
          {showPreviouslySeen ? <Eye size={14} /> : <EyeOff size={14} />}
          <span>{showPreviouslySeen ? 'Hide Previously Seen' : 'Show Previously Seen'}</span>
        </button>
      </div>

      {/* Visual Multi-Segment Bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.10)',
          borderRadius: 'var(--radius-pill)',
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {/* Unique Remaining */}
        <div
          style={{
            width: `${uniquePct}%`,
            backgroundColor: '#93ABD9',
            height: '100%',
          }}
          title={`Unique remaining: ${uniqueRemaining} (${uniquePct}%)`}
        />
        {/* Duplicates */}
        <div
          style={{
            width: `${dedupPct}%`,
            backgroundColor: '#E7BEF8',
            height: '100%',
          }}
          title={`Duplicates removed: ${duplicatesRemoved} (${dedupPct}%)`}
        />
        {/* Previously Seen */}
        <div
          style={{
            width: `${seenPct}%`,
            backgroundColor: '#EDE986',
            height: '100%',
          }}
          title={`Previously seen: ${previouslySeenFiltered} (${seenPct}%)`}
        />
      </div>
    </Card>
  );
};

