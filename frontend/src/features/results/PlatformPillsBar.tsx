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
          border: selectedPlatform === 'all' ? '1.5px solid #F2619C' : '1px solid rgba(255, 255, 255, 0.14)',
          backgroundColor: selectedPlatform === 'all' ? 'rgba(242, 97, 156, 0.25)' : 'rgba(255, 255, 255, 0.08)',
          color: selectedPlatform === 'all' ? '#FFFFFF' : 'rgba(255, 255, 255, 0.90)',
          fontWeight: selectedPlatform === 'all' ? 800 : 600,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          boxShadow: selectedPlatform === 'all' ? '0 0 16px rgba(242, 97, 156, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'all 0.15s ease',
        }}
      >
        <span>All Platforms</span>
        <span
          style={{
            backgroundColor: selectedPlatform === 'all' ? '#F2619C' : 'rgba(255, 255, 255, 0.15)',
            color: '#FFFFFF',
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
          border: selectedPlatform === 'instagram' ? '1.5px solid #E7BEF8' : '1px solid rgba(255, 255, 255, 0.14)',
          backgroundColor: selectedPlatform === 'instagram' ? 'rgba(231, 190, 248, 0.25)' : 'rgba(255, 255, 255, 0.08)',
          color: '#FFFFFF',
          fontWeight: selectedPlatform === 'instagram' ? 800 : 600,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          boxShadow: selectedPlatform === 'instagram' ? '0 0 16px rgba(231, 190, 248, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'all 0.15s ease',
        }}
      >
        <Instagram size={16} color="#FF649C" />
        <span>Instagram Reels</span>
        <span
          style={{
            backgroundColor: igShortfall > 0 ? 'rgba(251, 191, 36, 0.25)' : 'rgba(52, 211, 153, 0.25)',
            color: igShortfall > 0 ? '#FCD34D' : '#6EE7B7',
            border: `1px solid ${igShortfall > 0 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(52, 211, 153, 0.4)'}`,
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
              <AlertCircle size={12} color="#FBBF24" />
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
          border: selectedPlatform === 'meta' ? '1.5px solid #93ABD9' : '1px solid rgba(255, 255, 255, 0.14)',
          backgroundColor: selectedPlatform === 'meta' ? 'rgba(147, 171, 217, 0.25)' : 'rgba(255, 255, 255, 0.08)',
          color: '#FFFFFF',
          fontWeight: selectedPlatform === 'meta' ? 800 : 600,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          boxShadow: selectedPlatform === 'meta' ? '0 0 16px rgba(147, 171, 217, 0.35)' : '0 2px 8px rgba(0, 0, 0, 0.2)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'all 0.15s ease',
        }}
      >
        <Flame size={16} color="#60A5FA" />
        <span>Meta Ad Library</span>
        <span
          style={{
            backgroundColor: metaShortfall > 0 ? 'rgba(251, 191, 36, 0.25)' : 'rgba(52, 211, 153, 0.25)',
            color: metaShortfall > 0 ? '#FCD34D' : '#6EE7B7',
            border: `1px solid ${metaShortfall > 0 ? 'rgba(251, 191, 36, 0.4)' : 'rgba(52, 211, 153, 0.4)'}`,
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
              <AlertCircle size={12} color="#FBBF24" />
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
          border: tiktokEnabled ? '1.5px solid #EDE986' : '1px dashed rgba(255, 255, 255, 0.20)',
          backgroundColor: tiktokEnabled ? 'rgba(237, 233, 134, 0.22)' : 'rgba(255, 255, 255, 0.05)',
          color: tiktokEnabled ? '#EDE986' : 'rgba(254, 243, 199, 0.65)',
          fontWeight: 700,
          fontSize: '0.8125rem',
          cursor: 'pointer',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transition: 'all 0.15s ease',
        }}
      >
        <Music2 size={16} />
        <span>TikTok (Optional)</span>
        <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', opacity: 0.85 }}>
          {tiktokEnabled ? 'Active' : 'Off'}
        </span>
      </button>
    </div>
  );
};
