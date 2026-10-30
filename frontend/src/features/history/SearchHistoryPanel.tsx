import React, { useState, useMemo } from 'react';
import { Search as SearchIcon, ChevronLeft, Clock, Film, Sparkles } from 'lucide-react';
import { SearchItemSummary } from '../../types';

export interface SearchHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  history: SearchItemSummary[];
  activeSearchId: string | null;
  onSelectSearch: (searchId: string) => void;
}

export const SearchHistoryPanel: React.FC<SearchHistoryPanelProps> = ({
  isOpen,
  onClose,
  history,
  activeSearchId,
  onSelectSearch,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredHistory = useMemo(() => {
    if (!filterQuery.trim()) return history;
    const q = filterQuery.toLowerCase();
    return history.filter(
      (item) =>
        (item.productTitle && item.productTitle.toLowerCase().includes(q)) ||
        (item.queryText && item.queryText.toLowerCase().includes(q)) ||
        (item.productUrl && item.productUrl.toLowerCase().includes(q))
    );
  }, [history, filterQuery]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        width: '320px',
        height: '100%',
        backgroundColor: 'rgba(20, 11, 5, 0.88)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.12)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 40,
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.5)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="#FBBF24" />
          <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#FFFFFF' }}>
            Search History
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            cursor: 'pointer',
            color: 'rgba(254, 243, 199, 0.8)',
            display: 'flex',
            padding: '5px',
            borderRadius: 'var(--radius-sm)',
            transition: 'all 0.15s ease',
          }}
          title="Collapse Panel"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Search Input Box */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255, 255, 255, 0.10)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.14)',
            borderRadius: 'var(--radius-pill)',
            padding: '7px 14px',
            gap: '8px',
          }}
        >
          <SearchIcon size={14} color="rgba(254, 243, 199, 0.6)" />
          <input
            type="text"
            placeholder="Filter past searches..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: '0.8125rem',
              color: '#FFFFFF',
              width: '100%',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>
      </div>

      {/* History Items List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {filteredHistory.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'rgba(254, 243, 199, 0.6)', fontSize: '0.8125rem' }}>
            No past searches found.
          </div>
        ) : (
          filteredHistory.map((item) => {
            const isActive = activeSearchId === item.id;
            const title = item.productTitle || item.queryText || item.productUrl || 'Untitled Discovery';
            const formattedDate = new Date(item.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });

            return (
              <div
                key={item.id}
                onClick={() => onSelectSearch(item.id)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '16px',
                  backgroundColor: isActive ? 'rgba(231, 190, 248, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                  border: `1px solid ${isActive ? 'rgba(231, 190, 248, 0.50)' : 'rgba(255, 255, 255, 0.10)'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 0 16px rgba(231, 190, 248, 0.25)' : 'none',
                }}
              >
                {/* Title */}
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 800 : 700,
                    color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.92)',
                    lineHeight: 1.35,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {title}
                </div>

                {/* Timestamp */}
                <div style={{ fontSize: '0.6875rem', color: 'rgba(254, 243, 199, 0.60)', marginTop: '6px' }}>
                  {formattedDate}
                </div>

                {/* Stats Chips */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(242, 97, 156, 0.20)',
                      color: '#FFB3D1',
                      border: '1px solid rgba(242, 97, 156, 0.40)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Film size={10} color="#F2619C" />
                    {item.resultCount ?? 0} results
                  </span>

                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: 'rgba(147, 171, 217, 0.20)',
                      color: '#BFD0EF',
                      border: '1px solid rgba(147, 171, 217, 0.40)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Sparkles size={10} color="#93ABD9" />
                    {item.uniqueCount ?? item.resultCount ?? 0} unique
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
