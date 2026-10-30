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
            <span style={{ color: '#77717F' }}>Raw Collected: </span>
            <strong style={{ color: '#292633' }}>{totalCollected}</strong>
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: '#77717F' }}>Duplicates Removed: </span>
            <strong style={{ color: '#6B2B85' }}>-{duplicatesRemoved}</strong>
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: '#77717F' }}>Previously Seen Filtered: </span>
            <strong style={{ color: '#D97706' }}>-{previouslySeenFiltered}</strong>
          </div>
          <div style={{ fontSize: '0.8125rem' }}>
            <span style={{ color: '#77717F' }}>New Unique: </span>
            <strong style={{ color: '#314F85' }}>{uniqueRemaining}</strong>
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
            padding: '4px 12px',
            borderRadius: 'var(--radius-pill)',
            border: showPreviouslySeen ? '1.5px solid #F2619C' : '1px solid #E9E3ED',
            backgroundColor: showPreviouslySeen ? '#FDE8F1' : '#FFFFFF',
            color: showPreviouslySeen ? '#B82869' : '#77717F',
            fontSize: '0.75rem',
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
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
          backgroundColor: '#F5F2F7',
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

