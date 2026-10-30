import React from 'react';
import { Instagram, Flame, Music2, AlertCircle } from 'lucide-react';

export interface PlatformPillsBarProps {
  selectedPlatform: 'all' | 'instagram' | 'meta' | 'tiktok';
  onSelectPlatform: (platform: 'all' | 'instagram' | 'meta' | 'tiktok') => void;
  igCount: number;
  igShortfall: number;
  metaCount: number;
  metaShortfall: number;
  tiktokEnabled: boolean;
  onToggleTiktok: () => void;
}

export const PlatformPillsBar: React.FC<PlatformPillsBarProps> = ({
  selectedPlatform,
  onSelectPlatform,
  igCount,
  igShortfall,
  metaCount,
  metaShortfall,
  tiktokEnabled,
  onToggleTiktok,
}) => {
  const totalCount = igCount + metaCount;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      {/* All Pill */}
      <button
        type="button"
        onClick={() => onSelectPlatform('all')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 18px',
          borderRadius: 'var(--radius-pill)',
          border: selectedPlatform === 'all' ? '2px solid #F2619C' : '1px solid #E9E3ED',
          backgroundColor: selectedPlatform === 'all' ? '#FDE8F1' : '#FFFFFF',
          color: selectedPlatform === 'all' ? '#B82869' : '#292633',
          fontWeight: selectedPlatform === 'all' ? 800 : 600,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(147, 171, 217, 0.1)',
        }}
      >
        <span>All Platforms</span>
        <span
          style={{
            backgroundColor: selectedPlatform === 'all' ? '#F9A8CE' : '#F5F2F7',
            color: selectedPlatform === 'all' ? '#7A1040' : '#292633',
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.75rem',
            fontWeight: 800,
          }}
        >
          {totalCount}
        </span>
      </button>

      {/* Instagram Reels Pill */}
      <button
        type="button"
        onClick={() => onSelectPlatform('instagram')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 18px',
          borderRadius: 'var(--radius-pill)',
          border: selectedPlatform === 'instagram' ? '2px solid #E7BEF8' : '1px solid #E9E3ED',
          backgroundColor: selectedPlatform === 'instagram' ? '#F8EEFC' : '#FFFFFF',
          color: '#292633',
          fontWeight: selectedPlatform === 'instagram' ? 800 : 600,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(147, 171, 217, 0.1)',
        }}
      >
        <Instagram size={16} color="#E1306C" />
        <span>Instagram Reels</span>
        <span
          style={{
            backgroundColor: igShortfall > 0 ? '#FEF3C7' : '#D1FAE5',
            color: igShortfall > 0 ? '#92400E' : '#065F46',
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.75rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {igCount} / 20
          {igShortfall > 0 && (
            <span title={`Shortfall: -${igShortfall}`} style={{ display: 'inline-flex' }}>
              <AlertCircle size={12} color="#D97706" />
            </span>
          )}
        </span>
      </button>

      {/* Meta Ad Library Pill */}
      <button
        type="button"
        onClick={() => onSelectPlatform('meta')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 18px',
          borderRadius: 'var(--radius-pill)',
          border: selectedPlatform === 'meta' ? '2px solid #93ABD9' : '1px solid #E9E3ED',
          backgroundColor: selectedPlatform === 'meta' ? '#EBF1F9' : '#FFFFFF',
          color: '#292633',
          fontWeight: selectedPlatform === 'meta' ? 800 : 600,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(147, 171, 217, 0.1)',
        }}
      >
        <Flame size={16} color="#0064E0" />
        <span>Meta Ad Library</span>
        <span
          style={{
            backgroundColor: metaShortfall > 0 ? '#FEF3C7' : '#D1FAE5',
            color: metaShortfall > 0 ? '#92400E' : '#065F46',
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            fontSize: '0.75rem',
            fontWeight: 800,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {metaCount} / 20
          {metaShortfall > 0 && (
            <span title={`Shortfall: -${metaShortfall}`} style={{ display: 'inline-flex' }}>
              <AlertCircle size={12} color="#D97706" />
            </span>
          )}
        </span>
      </button>

      {/* TikTok Optional Toggle */}
      <button
        type="button"
        onClick={onToggleTiktok}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 18px',
          borderRadius: 'var(--radius-pill)',
          border: tiktokEnabled ? '2px solid #EDE986' : '1px dashed #E9E3ED',
          backgroundColor: tiktokEnabled ? '#FCFBE8' : '#FAF8F7',
          color: tiktokEnabled ? '#6E6B15' : '#77717F',
          fontWeight: 700,
          fontSize: '0.8125rem',
          cursor: 'pointer',
        }}
      >
        <Music2 size={16} />
        <span>TikTok (Optional)</span>
        <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', opacity: 0.8 }}>
          {tiktokEnabled ? 'Active' : 'Off'}
        </span>
      </button>
    </div>
  );
};
