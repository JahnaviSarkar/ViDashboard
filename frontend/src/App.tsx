import { useState, useEffect, useCallback } from 'react';
import './design-system/tokens.css';
import { LeftRail } from './components/LeftRail';
import { SearchHistoryPanel } from './features/history/SearchHistoryPanel';
import { TopSearchBar } from './features/search/TopSearchBar';
import { PipelineProgressView } from './features/pipeline/PipelineProgressView';
import { ResultsDashboardView } from './features/results/ResultsDashboardView';
import { ShortlistView } from './features/shortlist/ShortlistView';
import { ErrorStateView, ErrorType } from './components/ErrorStateView';
import { VideoPreviewModal } from './features/results/VideoPreviewModal';
import { createSearch, getSearchDetails, getRecentSearches } from './api/client';
import { SearchDetails, CandidateResult, SearchItemSummary } from './types';
import { Sparkles, Film, Compass, ShieldCheck, Zap, Loader2 } from 'lucide-react';

export default function App() {
  // Navigation tabs: 'home' | 'shortlist'
  const [currentTab, setCurrentTab] = useState<'home' | 'shortlist'>('home');
  // History panel toggle
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SearchItemSummary[]>([]);

  // Sub-views for Home: 'search' | 'progress' | 'results' | 'error'
  const [currentView, setCurrentView] = useState<'search' | 'progress' | 'results' | 'error'>('search');
  const [activeSearchId, setActiveSearchId] = useState<string | null>(null);
  const [searchDetails, setSearchDetails] = useState<SearchDetails | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);

  // Error state
  const [errorState, setErrorState] = useState<{ errorType: ErrorType; message: string } | null>(null);

  // Shortlist state persisted to localStorage
  const [shortlist, setShortlist] = useState<CandidateResult[]>(() => {
    try {
      const saved = localStorage.getItem('vidashboard_shortlist');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Preview modal for shortlist view
  const [previewResult, setPreviewResult] = useState<CandidateResult | null>(null);

  const handleSelectHistoricalSearch = useCallback(async (searchId: string) => {
    setActiveSearchId(searchId);
    setIsLoadingDetails(true);
    setErrorState(null);
    setCurrentTab('home');
    try {
      const details = await getSearchDetails(searchId);
      setSearchDetails(details);
      if (details.search.status === 'completed') {
        setCurrentView('results');
      } else if (details.search.status === 'failed') {
        setErrorState({
          errorType: 'COLLECTION_FAILED',
          message: 'This historical search encountered an execution failure.',
        });
        setCurrentView('error');
      } else {
        setCurrentView('progress');
      }
    } catch (err: any) {
      setErrorState({
        errorType: 'GENERIC_ERROR',
        message: err.message || 'Could not load historical search details.',
      });
      setCurrentView('error');
    } finally {
      setIsLoadingDetails(false);
    }
  }, []);

  const loadHistory = useCallback(async (autoSelectRecent = false) => {
    try {
      const list = await getRecentSearches(25);
      setHistory(list);
      if (autoSelectRecent && list.length > 0) {
        const completed = list.find((s) => s.status === 'completed');
        if (completed) {
          handleSelectHistoricalSearch(completed.id);
        }
      }
    } catch {
      // ignore history load error
    }
  }, [handleSelectHistoricalSearch]);

  useEffect(() => {
    loadHistory(true);
  }, [loadHistory]);

  const handleToggleShortlist = (result: CandidateResult) => {
    setShortlist((prev) => {
      const exists = prev.some(
        (item) => item.id === result.id || item.video.platformVideoId === result.video.platformVideoId
      );
      const updated = exists
        ? prev.filter(
            (item) => item.id !== result.id && item.video.platformVideoId !== result.video.platformVideoId
          )
        : [...prev, result];
      try {
        localStorage.setItem('vidashboard_shortlist', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleSearch = async (input: { text: string; image?: File }) => {
    setIsLoadingSearch(true);
    setErrorState(null);
    try {
      const isUrl = /^https?:\/\//i.test(input.text.trim());
      let inputType: 'product_url' | 'keyword' | 'image_upload' = 'keyword';
      if (input.image) {
        inputType = 'image_upload';
      } else if (isUrl) {
        inputType = 'product_url';
      }

      const res = await createSearch({
        inputType,
        url: isUrl ? input.text.trim() : undefined,
        query: !isUrl ? input.text.trim() : undefined,
        image: input.image,
        sources: ['instagram', 'meta'],
        minMatchThreshold: 60,
      });

      setActiveSearchId(res.searchId);
      setCurrentView('progress');
      setCurrentTab('home');
      loadHistory();
    } catch (err: any) {
      const msg = err.message || 'An error occurred while creating the search.';
      let errorType: ErrorType = 'GENERIC_ERROR';
      if (msg.includes('PRODUCT_EXTRACTION_FAILED') || msg.includes('extraction')) {
        errorType = 'PRODUCT_EXTRACTION_FAILED';
      } else if (msg.includes('COLLECTION_FAILED')) {
        errorType = 'COLLECTION_FAILED';
      } else if (msg.includes('ANALYSIS_FAILED')) {
        errorType = 'ANALYSIS_FAILED';
      } else if (msg.includes('TIMEOUT')) {
        errorType = 'TIMEOUT';
      } else if (msg.includes('INSUFFICIENT')) {
        errorType = 'INSUFFICIENT_RESULTS';
      }
      setErrorState({ errorType, message: msg });
      setCurrentView('error');
    } finally {
      setIsLoadingSearch(false);
    }
  };

  const handlePipelineCompleted = async () => {
    if (!activeSearchId) return;
    setIsLoadingDetails(true);
    try {
      const details = await getSearchDetails(activeSearchId);
      setSearchDetails(details);
      if (details.search.status === 'failed') {
        setErrorState({
          errorType: 'COLLECTION_FAILED',
          message: 'The search pipeline finished with a failure status.',
        });
        setCurrentView('error');
      } else {
        setCurrentView('results');
      }
      loadHistory();
    } catch (err: any) {
      setErrorState({
        errorType: 'GENERIC_ERROR',
        message: err.message || 'Failed to retrieve search results.',
      });
      setCurrentView('error');
    } finally {
      setIsLoadingDetails(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '32px 20px',
        boxSizing: 'border-box',
        position: 'relative',
        gap: '20px',
        maxWidth: '1540px',
        margin: '0 auto',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Ambient background glow orbs */}
      <div className="ambient-glow ambient-glow-1" />
      <div className="ambient-glow ambient-glow-2" />
      <div className="ambient-glow ambient-glow-3" />

      {/* 1. Slim Left Rail Dock - Floating OUTSIDE the bg layout sideways */}
      <LeftRail
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'home' && currentView === 'error') {
            setCurrentView('search');
          }
        }}
        isHistoryOpen={isHistoryOpen}
        onToggleHistory={() => setIsHistoryOpen((prev) => !prev)}
        shortlistCount={shortlist.length}
      />

      {/* 2. Centered Floating Glass Shell Container ("bg layout") */}
      <div
        id="app-floating-viewport"
        style={{
          flex: 1,
          maxWidth: '1380px',
          minHeight: 'calc(100vh - 64px)',
          borderRadius: '32px',
          border: '1px solid rgba(254, 243, 199, 0.20)',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          backgroundColor: 'rgba(18, 10, 5, 0.70)',
          display: 'flex',
          position: 'relative',
          overflow: 'hidden',
          zIndex: 1,
        }}
      >
        {/* Persistent, Collapsible Search History Panel */}
        <SearchHistoryPanel
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          history={history}
          activeSearchId={activeSearchId}
          onSelectSearch={handleSelectHistoricalSearch}
        />

        {/* 3. Main Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
          {/* Top Header with App Brand and Search Input */}
          <header
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 30,
              backgroundColor: 'rgba(18, 10, 5, 0.45)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
              padding: '16px 28px',
            }}
          >
            <div
              style={{
                maxWidth: '1280px',
                margin: '0 auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
              }}
            >
              {/* Top row: Brand & Search bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '24px',
                  flexWrap: 'wrap',
                }}
              >
                <div
                  onClick={() => {
                    setCurrentTab('home');
                    setCurrentView('search');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '12px',
                      backgroundColor: 'rgba(242, 97, 156, 0.18)',
                      border: '1px solid rgba(242, 97, 156, 0.38)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#F2619C',
                      boxShadow: '0 2px 12px rgba(242, 97, 156, 0.3)',
                    }}
                  >
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '1.25rem',
                        fontWeight: 800,
                        color: '#FFFFFF',
                        letterSpacing: '-0.02em',
                        lineHeight: 1.1,
                      }}
                    >
                      ViDashboard
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'rgba(254, 243, 199, 0.65)', fontWeight: 600 }}>
                      Visual Video Discovery &amp; Verification
                    </div>
                  </div>
                </div>

                {/* Large rounded search bar with image upload beside it & raspberry button */}
                <div style={{ flex: 1, maxWidth: '820px' }}>
                  <TopSearchBar onSearch={handleSearch} isLoading={isLoadingSearch} />
                </div>
              </div>
            </div>
          </header>

          {/* View Routing */}
          <main style={{ flex: 1, padding: '28px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
            {isLoadingDetails ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '120px 20px', gap: '16px' }}>
                <Loader2 size={36} color="#F2619C" className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ color: 'rgba(254, 243, 199, 0.70)', fontSize: '0.9375rem', fontWeight: 600 }}>Loading verified video intelligence...</span>
              </div>
            ) : currentTab === 'shortlist' ? (
              <ShortlistView
                shortlist={shortlist}
                onToggleShortlist={handleToggleShortlist}
                onOpenPreview={(res) => setPreviewResult(res)}
                onBackToSearch={() => {
                  setCurrentTab('home');
                  if (searchDetails) setCurrentView('results');
                  else setCurrentView('search');
                }}
              />
            ) : (
              <>
                {currentView === 'search' && (
                  <div
                    style={{
                      maxWidth: '840px',
                      margin: '60px auto',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '28px',
                    }}
                  >
                    <div
                      style={{
                        width: '72px',
                        height: '72px',
                        borderRadius: '24px',
                        backgroundColor: 'rgba(242, 97, 156, 0.16)',
                        border: '1px solid rgba(242, 97, 156, 0.38)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#F2619C',
                        boxShadow: '0 4px 20px rgba(242, 97, 156, 0.3)',
                      }}
                    >
                      <Film size={36} />
                    </div>

                    <div>
                      <h1
                        style={{
                          fontSize: '2.25rem',
                          fontWeight: 800,
                          color: '#FFFFFF',
                          letterSpacing: '-0.025em',
                          marginBottom: '10px',
                        }}
                      >
                        Multimodal Product Video Discovery
                      </h1>
                      <p
                        style={{
                          fontSize: '1rem',
                          color: 'rgba(254, 243, 199, 0.75)',
                          maxWidth: '580px',
                          lineHeight: 1.6,
                          margin: '0 auto',
                        }}
                      >
                        Paste a verified product URL or upload an image above to extract visual attributes,
                        synthesize search queries, and verify matching Instagram Reels and Meta Ad Library videos.
                      </p>
                    </div>

                    {/* Feature Highlights in A-Toys pastel cards with dark glass styling */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                        gap: '16px',
                        width: '100%',
                        marginTop: '12px',
                      }}
                    >
                      <div
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          border: '1px solid rgba(255, 255, 255, 0.10)',
                          borderRadius: '16px',
                          padding: '20px',
                          textAlign: 'left',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(231, 190, 248, 0.16)',
                            border: '1px solid rgba(231, 190, 248, 0.30)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#E7BEF8',
                            marginBottom: '12px',
                          }}
                        >
                          <Zap size={18} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '4px', color: '#FFFFFF' }}>
                          Image Brain VLM
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'rgba(254, 243, 199, 0.65)', lineHeight: 1.5 }}>
                          Multimodal Gemini visual attribute extraction and hashtag concept synthesis.
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          border: '1px solid rgba(255, 255, 255, 0.10)',
                          borderRadius: '16px',
                          padding: '20px',
                          textAlign: 'left',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(147, 171, 217, 0.16)',
                            border: '1px solid rgba(147, 171, 217, 0.30)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#93ABD9',
                            marginBottom: '12px',
                          }}
                        >
                          <Compass size={18} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '4px', color: '#FFFFFF' }}>
                          Cross-Platform Scrapers
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'rgba(254, 243, 199, 0.65)', lineHeight: 1.5 }}>
                          Targeted Instagram Reels hashtag search &amp; Meta Ad Library video campaigns.
                        </div>
                      </div>

                      <div
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.06)',
                          backdropFilter: 'blur(16px)',
                          WebkitBackdropFilter: 'blur(16px)',
                          border: '1px solid rgba(255, 255, 255, 0.10)',
                          borderRadius: '16px',
                          padding: '20px',
                          textAlign: 'left',
                          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
                        }}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(237, 233, 134, 0.16)',
                            border: '1px solid rgba(237, 233, 134, 0.30)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#EDE986',
                            marginBottom: '12px',
                          }}
                        >
                          <ShieldCheck size={18} />
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: '4px', color: '#FFFFFF' }}>
                          Hybrid Scoring &amp; Dedup
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'rgba(254, 243, 199, 0.65)', lineHeight: 1.5 }}>
                          Frame extraction, visual evidence grounding, and perceptual dHash deduplication.
                        </div>
                      </div>
                    </div>
                  </div>
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
                    shortlist={shortlist}
                    onToggleShortlist={handleToggleShortlist}
                    onRetryShortfall={() => {
                      if (activeSearchId) handleSearch({ text: searchDetails.search.productUrl || searchDetails.search.queryText || '' });
                    }}
                  />
                )}

                {currentView === 'error' && (
                  <ErrorStateView
                    errorType={errorState?.errorType || 'GENERIC_ERROR'}
                    message={errorState?.message}
                    onRetry={() => {
                      if (activeSearchId) {
                        setCurrentView('progress');
                      } else {
                        setCurrentView('search');
                      }
                    }}
                    onBack={() => setCurrentView('search')}
                  />
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* Video Preview Modal when clicked from Shortlist */}
      {previewResult && (
        <VideoPreviewModal
          result={previewResult}
          isOpen={!!previewResult}
          onClose={() => setPreviewResult(null)}
        />
      )}
    </div>
  );
}
