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
        width: '300px',
        height: '100vh',
        position: 'sticky',
        top: 0,
        backgroundColor: '#FFFFFF',
        borderRight: '1px solid #E9E3ED',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        zIndex: 40,
        boxShadow: '2px 0 12px rgba(147, 171, 217, 0.08)',
        animation: 'fadeIn 0.2s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 18px',
          borderBottom: '1px solid #E9E3ED',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Clock size={18} color="#93ABD9" />
          <span style={{ fontWeight: 800, fontSize: '0.9375rem', color: '#292633' }}>
            Search History
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: '#77717F',
            display: 'flex',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
          }}
          title="Collapse Panel"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      {/* Search Input Box */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E9E3ED' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#FAF8F7',
            border: '1px solid #E9E3ED',
            borderRadius: 'var(--radius-pill)',
            padding: '6px 12px',
            gap: '8px',
          }}
        >
          <SearchIcon size={14} color="#77717F" />
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
              color: '#292633',
              width: '100%',
              fontFamily: 'var(--font-sans)',
            }}
          />
        </div>
      </div>

      {/* History Items List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredHistory.length === 0 ? (
          <div style={{ padding: '24px 12px', textAlign: 'center', color: '#77717F', fontSize: '0.8125rem' }}>
            No searches found.
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
                  borderRadius: '14px',
                  backgroundColor: isActive ? '#E7BEF8' : '#FAF8F7',
                  border: `1px solid ${isActive ? '#D8A5EC' : '#E9E3ED'}`,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: isActive ? '0 2px 8px rgba(231, 190, 248, 0.35)' : 'none',
                }}
              >
                {/* Title */}
                <div
                  style={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 800 : 700,
                    color: '#292633',
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {title}
                </div>

                {/* Timestamp */}
                <div style={{ fontSize: '0.6875rem', color: '#77717F', marginTop: '6px' }}>
                  {formattedDate}
                </div>

                {/* Stats Chips: Result Count & Unique-Video Count */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '8px', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      backgroundColor: isActive ? '#FFFFFF' : '#FFFFFF',
                      color: '#292633',
                      border: '1px solid #E9E3ED',
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
                      backgroundColor: isActive ? '#FFFFFF' : '#FFFFFF',
                      color: '#314F85',
                      border: '1px solid #93ABD9',
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

