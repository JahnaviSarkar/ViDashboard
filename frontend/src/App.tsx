import { useState } from 'react';
import {
  Sun,
  Moon,
  Clock,
  Video,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { ThemeProvider, useTheme, Button } from './design-system';
import './design-system/tokens.css';
import { SearchInputView } from './features/search/SearchInputView';
import { PipelineProgressView } from './features/pipeline/PipelineProgressView';
import { ResultsDashboardView } from './features/results/ResultsDashboardView';
import { RecentSearchesModal } from './features/history/RecentSearchesModal';
import { getSearchDetails } from './api/client';
import { SearchDetails } from './types';

function DashboardContent() {
  const { resolvedTheme, toggleTheme } = useTheme();

  // Navigation: 'search' | 'progress' | 'results'
  const [currentView, setCurrentView] = useState<'search' | 'progress' | 'results'>('search');
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [searchDetails, setSearchDetails] = useState<SearchDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Transition from Search Input -> Progress Stepper
  const handleSearchStarted = (searchId: string) => {
    setActiveSearchId(searchId);
    setSearchDetails(null);
    setCurrentView('progress');
  };

  // Transition from Progress Stepper -> Results Dashboard
  const handlePipelineCompleted = async () => {
    if (!activeSearchId) return;
    try {
      setIsLoadingDetails(true);
      const details = await getSearchDetails(activeSearchId);
      setSearchDetails(details);
      setCurrentView('results');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load finalized search results.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // Load a search from history or direct selection
  const handleSelectHistoricalSearch = async (searchId: string) => {
    try {
      setActiveSearchId(searchId);
      setIsLoadingDetails(true);
      const details = await getSearchDetails(searchId);
      setSearchDetails(details);
      if (details.search.status === 'completed') {
        setCurrentView('results');
      } else {
        setCurrentView('progress');
      }
    } catch (err: any) {
      setErrorMessage('Could not load historical search.');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Top Navbar */}
      <header
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Brand Logo */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
            onClick={() => setCurrentView('search')}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <Video size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.125rem', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                ViDashboard
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                Visual Video Intelligence
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setHistoryModalOpen(true)}
              leftIcon={<Clock size={16} />}
            >
              History
            </Button>

            <button
              type="button"
              onClick={toggleTheme}
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-secondary)',
              }}
              title="Toggle theme"
            >
              {resolvedTheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ flex: 1, padding: '36px 24px', display: 'flex', flexDirection: 'column' }}>
        {errorMessage && (
          <div
            style={{
              maxWidth: '780px',
              margin: '0 auto 20px',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--danger-subtle)',
              color: 'var(--danger-text)',
              fontSize: '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        {isLoadingDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px' }}>
            <Loader2 size={32} className="animate-spin" color="var(--primary)" />
            <span style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>Loading matched videos...</span>
          </div>
        ) : (
          <>
            {currentView === 'search' && (
              <SearchInputView
                onSearchStarted={handleSearchStarted}
                onOpenHistory={() => setHistoryModalOpen(true)}
              />
            )}

            {currentView === 'progress' && activeSearchId && (
              <PipelineProgressView
                searchId={activeSearchId}
                onCompleted={handlePipelineCompleted}
                onCancel={() => setCurrentView('search')}
              />
            )}

            {currentView === 'results' && searchDetails && (
              <ResultsDashboardView
                searchDetails={searchDetails}
                onNewSearch={() => setCurrentView('search')}
              />
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          padding: '16px 24px',
          textAlign: 'center',
          fontSize: '0.8125rem',
          color: 'var(--text-muted)',
          backgroundColor: 'var(--bg-card)',
        }}
      >
        ViDashboard &copy; 2026 Jahnavi. Multimodal Video Discovery & Verification Engine.
      </footer>

      {/* History Modal */}
      <RecentSearchesModal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        onSelectSearch={handleSelectHistoricalSearch}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <DashboardContent />
    </ThemeProvider>
  );
}
