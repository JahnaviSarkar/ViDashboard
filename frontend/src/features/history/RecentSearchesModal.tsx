import React, { useEffect, useState } from 'react';
import { Clock, ArrowRight, Loader2 } from 'lucide-react';
import { Modal, Badge } from '../../design-system';
import { getRecentSearches } from '../../api/client';
import { SearchItemSummary } from '../../types';

export interface RecentSearchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSearch: (searchId: string) => void;
}

export const RecentSearchesModal: React.FC<RecentSearchesModalProps> = ({
  isOpen,
  onClose,
  onSelectSearch,
}) => {
  const [history, setHistory] = useState<SearchItemSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      getRecentSearches(15)
        .then(setHistory)
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Discovery History" maxWidth="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
            <Loader2 size={24} className="animate-spin" color="var(--primary)" />
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
            No past searches recorded yet.
          </div>
        ) : (
          history.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                onSelectSearch(item.id);
                onClose();
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-app)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                  {item.productTitle || item.queryText || item.productUrl || 'Untitled Search'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{item.inputType.replace('_', ' ')}</span>
                  <span>•</span>
                  <Badge size="sm" variant={item.mode === 'live' ? 'success' : 'warning'}>
                    {item.mode}
                  </Badge>
                </div>
              </div>

              <ArrowRight size={16} color="var(--text-muted)" />
            </div>
          ))
        )}
      </div>
    </Modal>
  );
};
