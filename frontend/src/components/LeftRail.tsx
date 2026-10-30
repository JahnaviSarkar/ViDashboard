import React from 'react';
import { Sparkles, Compass, Clock, Bookmark } from 'lucide-react';

export interface LeftRailProps {
  currentTab: 'home' | 'shortlist';
  onSelectTab: (tab: 'home' | 'shortlist') => void;
  isHistoryOpen: boolean;
  onToggleHistory: () => void;
  shortlistCount: number;
}

export const LeftRail: React.FC<LeftRailProps> = ({
  currentTab,
  onSelectTab,
  isHistoryOpen,
  onToggleHistory,
  shortlistCount,
}) => {
  return (
    <aside
      style={{
        width: '68px',
        backgroundColor: 'rgba(28, 16, 9, 0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(254, 243, 199, 0.16)',
        borderRadius: 'var(--radius-pill, 9999px)',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 25px rgba(245, 158, 11, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 8px',
        margin: 0,
        zIndex: 50,
        flexShrink: 0,
        height: 'fit-content',
        position: 'sticky',
        top: '32px',
        gap: '12px',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Brand Icon (Sparkles with glowing ring) */}
      <button
        type="button"
        onClick={() => onSelectTab('home')}
        style={{
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          backgroundColor: 'rgba(242, 97, 156, 0.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFB3D1',
          cursor: 'pointer',
          border: '1.5px solid rgba(242, 97, 156, 0.65)',
          boxShadow: '0 0 16px rgba(242, 97, 156, 0.45)',
          transition: 'all 0.2s ease',
          outline: 'none',
        }}
        title="ViDashboard Home"
      >
        <Sparkles size={20} />
      </button>

      {/* Nav Icons */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
        {/* Home / Discover */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            border: currentTab === 'home' && !isHistoryOpen ? '1px solid rgba(242, 97, 156, 0.45)' : '1px solid transparent',
            backgroundColor: currentTab === 'home' && !isHistoryOpen ? 'rgba(242, 97, 156, 0.28)' : 'transparent',
            color: currentTab === 'home' && !isHistoryOpen ? '#FFB3D1' : 'rgba(254, 243, 199, 0.80)',
            boxShadow: currentTab === 'home' && !isHistoryOpen ? '0 0 16px rgba(242, 97, 156, 0.40)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            outline: 'none',
          }}
          title="Discover / Home"
        >
          <Compass size={20} />
        </button>

        {/* History Toggle */}
        <button
          type="button"
          onClick={onToggleHistory}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            border: isHistoryOpen ? '1px solid rgba(231, 190, 248, 0.50)' : '1px solid transparent',
            backgroundColor: isHistoryOpen ? 'rgba(231, 190, 248, 0.25)' : 'transparent',
            color: isHistoryOpen ? '#F3D5FC' : 'rgba(254, 243, 199, 0.80)',
            boxShadow: isHistoryOpen ? '0 0 16px rgba(231, 190, 248, 0.35)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            position: 'relative',
            outline: 'none',
          }}
          title="Search History"
        >
          <Clock size={20} />
          {isHistoryOpen && (
            <div
              style={{
                position: 'absolute',
                top: '9px',
                right: '9px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#E7BEF8',
                boxShadow: '0 0 6px #E7BEF8',
              }}
            />
          )}
        </button>

        {/* Shortlist */}
        <button
          type="button"
          onClick={() => onSelectTab('shortlist')}
          style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            border: currentTab === 'shortlist' ? '1px solid rgba(242, 97, 156, 0.45)' : '1px solid transparent',
            backgroundColor: currentTab === 'shortlist' ? 'rgba(242, 97, 156, 0.28)' : 'transparent',
            color: currentTab === 'shortlist' ? '#FFB3D1' : 'rgba(254, 243, 199, 0.80)',
            boxShadow: currentTab === 'shortlist' ? '0 0 16px rgba(242, 97, 156, 0.40)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            position: 'relative',
            outline: 'none',
          }}
          title="Shortlist"
        >
          <Bookmark size={20} />
          {shortlistCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '4px',
                right: '4px',
                backgroundColor: '#F2619C',
                color: '#FFFFFF',
                borderRadius: '999px',
                fontSize: '0.625rem',
                fontWeight: 800,
                padding: '1px 5px',
                lineHeight: 1,
                boxShadow: '0 0 8px rgba(242, 97, 156, 0.5)',
              }}
            >
              {shortlistCount}
            </span>
          )}
        </button>
      </nav>
    </aside>
  );
};
