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
        width: '64px',
        backgroundColor: 'rgba(255, 255, 255, 0.10)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 'var(--radius-pill, 9999px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 8px',
        margin: '24px 0 24px 20px',
        zIndex: 50,
        flexShrink: 0,
        height: 'fit-content',
        position: 'sticky',
        top: '24px',
      }}
    >
      {/* Brand Icon */}
      <div
        onClick={() => onSelectTab('home')}
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '50%',
          backgroundColor: 'rgba(242, 97, 156, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFB3D1',
          cursor: 'pointer',
          marginBottom: '20px',
          border: '1px solid rgba(242, 97, 156, 0.50)',
          boxShadow: '0 0 16px rgba(242, 97, 156, 0.35)',
          transition: 'all 0.2s ease',
        }}
        title="ViDashboard"
      >
        <Sparkles size={20} />
      </div>

      {/* Nav Icons */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', alignItems: 'center' }}>
        {/* Home / Discover */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: currentTab === 'home' && !isHistoryOpen ? 'rgba(242, 97, 156, 0.28)' : 'transparent',
            color: currentTab === 'home' && !isHistoryOpen ? '#FFB3D1' : 'rgba(254, 243, 199, 0.70)',
            boxShadow: currentTab === 'home' && !isHistoryOpen ? '0 0 14px rgba(242, 97, 156, 0.3)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
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
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: isHistoryOpen ? 'rgba(231, 190, 248, 0.28)' : 'transparent',
            color: isHistoryOpen ? '#F3D5FC' : 'rgba(254, 243, 199, 0.70)',
            boxShadow: isHistoryOpen ? '0 0 14px rgba(231, 190, 248, 0.3)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
          title="Search History"
        >
          <Clock size={20} />
          {isHistoryOpen && (
            <div
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
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
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            border: 'none',
            backgroundColor: currentTab === 'shortlist' ? 'rgba(242, 97, 156, 0.28)' : 'transparent',
            color: currentTab === 'shortlist' ? '#FFB3D1' : 'rgba(254, 243, 199, 0.70)',
            boxShadow: currentTab === 'shortlist' ? '0 0 14px rgba(242, 97, 156, 0.3)' : 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            position: 'relative',
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
