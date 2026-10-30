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
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E9E3ED',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '16px 0',
        zIndex: 50,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
      }}
    >
      {/* Brand Icon */}
      <div
        onClick={() => onSelectTab('home')}
        style={{
          width: '42px',
          height: '42px',
          borderRadius: '14px',
          backgroundColor: '#FDE8F1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F2619C',
          cursor: 'pointer',
          marginBottom: '28px',
          border: '1px solid #F9A8CE',
          boxShadow: '0 2px 8px rgba(242, 97, 156, 0.25)',
          transition: 'transform 0.15s ease',
        }}
        title="ViDashboard"
      >
        <Sparkles size={22} />
      </div>

      {/* Nav Icons */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', alignItems: 'center' }}>
        {/* Home / Discover */}
        <button
          type="button"
          onClick={() => onSelectTab('home')}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: currentTab === 'home' && !isHistoryOpen ? '#F8EEFC' : 'transparent',
            color: currentTab === 'home' && !isHistoryOpen ? '#6B2B85' : '#77717F',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
          }}
          title="Discover / Home"
        >
          <Compass size={22} />
        </button>

        {/* History Toggle */}
        <button
          type="button"
          onClick={onToggleHistory}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            border: 'none',
            backgroundColor: isHistoryOpen ? '#EBF1F9' : 'transparent',
            color: isHistoryOpen ? '#314F85' : '#77717F',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
          title="Search History"
        >
          <Clock size={22} />
          {isHistoryOpen && (
            <div
              style={{
                position: 'absolute',
                top: '8px',
                right: '8px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#93ABD9',
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
            borderRadius: '12px',
            border: 'none',
            backgroundColor: currentTab === 'shortlist' ? '#FDE8F1' : 'transparent',
            color: currentTab === 'shortlist' ? '#F2619C' : '#77717F',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s ease',
            position: 'relative',
          }}
          title="Shortlist"
        >
          <Bookmark size={22} />
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

