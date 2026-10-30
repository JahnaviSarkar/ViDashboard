import React, { useState, useMemo } from 'react';
import {
  RotateCcw,
  AlertTriangle,
  FileSpreadsheet,
  FileCode,
  Search as SearchIcon,
} from 'lucide-react';
import { Card, Button, Input, Slider } from '../../design-system';
import { SearchDetails, CandidateResult } from '../../types';
import { VideoCard } from './VideoCard';
import { VideoPreviewModal } from './VideoPreviewModal';
import { ProductAnalysisPanel } from './ProductAnalysisPanel';
import { PlatformPillsBar } from './PlatformPillsBar';
import { UniquenessBar } from './UniquenessBar';
import { ShortfallBanner } from './ShortfallBanner';
import { MockDataBanner } from './MockDataBanner';

export interface ResultsDashboardViewProps {
  searchDetails: SearchDetails;
  onNewSearch: () => void;
  shortlist: CandidateResult[];
  onToggleShortlist: (result: CandidateResult) => void;
  onRetryShortfall?: () => void;
}

export const ResultsDashboardView: React.FC<ResultsDashboardViewProps> = ({
  searchDetails,
  onNewSearch,
  shortlist,
  onToggleShortlist,
  onRetryShortfall,
}) => {
  const { product, analysis, sourceRuns, results, search } = searchDetails;

  // Platform & Filter state
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | 'instagram' | 'meta' | 'tiktok'>('all');
  const [tiktokEnabled, setTiktokEnabled] = useState(false);
  const [minScore, setMinScore] = useState<number>(search.minMatchThreshold || 60);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');
  const [showPreviouslySeen, setShowPreviouslySeen] = useState(false);

  // Preview modal
  const [previewResult, setPreviewResult] = useState<CandidateResult | null>(null);

  // Source counts
  const igRun = sourceRuns.find((r) => r.source === 'instagram');
  const metaRun = sourceRuns.find((r) => r.source === 'meta');
  const igCount = igRun?.usable ?? results.filter((r) => r.video.platform === 'instagram').length;
  const igShortfall = igRun?.shortfall ?? 0;
  const metaCount = metaRun?.usable ?? results.filter((r) => r.video.platform === 'meta').length;
  const metaShortfall = metaRun?.shortfall ?? 0;

  // Uniqueness stats calculation
  const totalCollected = (igRun?.collected ?? 0) + (metaRun?.collected ?? 0) || results.length;
  const duplicatesRemoved = search.stats?.duplicatesRemoved ?? Math.max(0, totalCollected - results.length);
  const previouslySeenFiltered = search.stats?.previouslySeenFiltered ?? results.filter((r) => r.previouslySeen).length;
  const uniqueRemaining = results.filter((r) => !r.previouslySeen).length;

  const isMockData = search.mode === 'mock' || results.some((r) => r.video.isMock);

  // Filter & Sort
  const filteredResults = useMemo(() => {
    return results
      .filter((item) => {
        // Previously seen filter toggle
        if (!showPreviouslySeen && item.previouslySeen) {
          return false;
        }
        // Platform filter
        if (selectedPlatform !== 'all' && item.video.platform !== selectedPlatform) {
          return false;
        }
        // Min score slider filter
        if (item.matchScore < minScore) {
          return false;
        }
        // Keyword text filter
        if (searchQuery.trim()) {
          const text = `${item.video.caption || ''} ${item.video.author || ''} ${item.video.platformVideoId}`.toLowerCase();
          if (!text.includes(searchQuery.toLowerCase())) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'score') {
          return b.matchScore - a.matchScore;
        }
        const dateA = a.video.postedAt ? new Date(a.video.postedAt).getTime() : 0;
        const dateB = b.video.postedAt ? new Date(b.video.postedAt).getTime() : 0;
        return dateB - dateA;
      });
  }, [results, selectedPlatform, minScore, searchQuery, sortBy, showPreviouslySeen]);

  // Export handlers
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredResults, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `vidashboard_results_${search.id}.json`;
    a.click();
  };

  const handleExportCSV = () => {
    const headers = ['Platform', 'VideoId', 'MatchScore', 'Evidence', 'Author', 'PostedAt', 'URL', 'Caption', 'Explanation'];
    const rows = filteredResults.map((r) => [
      r.video.platform,
      r.video.platformVideoId,
      r.matchScore,
      r.scoreBreakdown?.evidence || '',
      `"${(r.video.author || '').replace(/"/g, '""')}"`,
      r.video.postedAt || '',
      r.video.canonicalUrl,
      `"${(r.video.caption || '').replace(/"/g, '""')}"`,
      `"${(r.explanation || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const a = document.createElement('a');
    a.href = encodedUri;
    a.download = `vidashboard_results_${search.id}.csv`;
    a.click();
  };

  const isShortlisted = (videoId: string) => shortlist.some((item) => item.videoId === videoId || item.id === videoId);

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* MOCK DATA BANNER if isMock */}
      <MockDataBanner isMock={isMockData} />

      {/* Honest Shortfall Banner if shortfall > 0 */}
      <ShortfallBanner sourceRuns={sourceRuns} onRetry={onRetryShortfall} />

      {/* Top Header / Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#292633', letterSpacing: '-0.02em' }}>
            Video Match Intelligence
          </h1>
          <span style={{ fontSize: '0.8125rem', color: '#77717F' }}>
            Showing {filteredResults.length} scored candidates above {minScore}% match
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button size="sm" variant="secondary" onClick={handleExportCSV} leftIcon={<FileSpreadsheet size={14} />}>
            Export CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={handleExportJSON} leftIcon={<FileCode size={14} />}>
            Export JSON
          </Button>
          <Button size="sm" variant="raspberry" onClick={onNewSearch} leftIcon={<RotateCcw size={14} />}>
            New Search
          </Button>
        </div>
      </div>

      {/* Product Analysis Panel */}
      <ProductAnalysisPanel product={product} analysis={analysis} />

      {/* Platform Pills Bar (live count n / 20 with shortfall indicator) */}
      <PlatformPillsBar
        selectedPlatform={selectedPlatform}
        onSelectPlatform={setSelectedPlatform}
        igCount={igCount}
        igShortfall={igShortfall}
        metaCount={metaCount}
        metaShortfall={metaShortfall}
        tiktokEnabled={tiktokEnabled}
        onToggleTiktok={() => setTiktokEnabled((prev) => !prev)}
      />

      {/* Uniqueness Bar with Show Previously Seen Toggle */}
      <UniquenessBar
        totalCollected={totalCollected}
        duplicatesRemoved={duplicatesRemoved}
        previouslySeenFiltered={previouslySeenFiltered}
        uniqueRemaining={uniqueRemaining}
        showPreviouslySeen={showPreviouslySeen}
        onToggleShowPreviouslySeen={() => setShowPreviouslySeen((prev) => !prev)}
      />

      {/* Filter and Sorting Toolbar */}
      <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: '16px', alignItems: 'center' }}>
          {/* Keyword Search */}
          <Input
            placeholder="Search keywords, authors, or captions in results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<SearchIcon size={16} />}
          />

          {/* Threshold Slider */}
          <Slider
            label="Match Score Threshold"
            value={minScore}
            min={40}
            max={90}
            step={5}
            onChange={setMinScore}
            helperText={`Showing candidates scoring >= ${minScore}%`}
          />

          {/* Sort Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: '#77717F', fontWeight: 700, whiteSpace: 'nowrap' }}>
              Sort:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                backgroundColor: '#FFFFFF',
                color: '#292633',
                border: '1.5px solid #E9E3ED',
                borderRadius: 'var(--radius-pill)',
                padding: '8px 14px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="score">Highest Match Score</option>
              <option value="date">Newest First</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Video Cards Grid */}
      {filteredResults.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <AlertTriangle size={36} color="#93ABD9" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#292633', marginBottom: '8px' }}>
            {previouslySeenFiltered > 0 && !showPreviouslySeen
              ? `${previouslySeenFiltered} Candidate Videos Filtered as Previously Seen`
              : 'No matching videos match the current filters'}
          </h3>
          <p style={{ color: '#77717F', fontSize: '0.875rem', maxWidth: '460px', margin: '0 auto 20px' }}>
            {previouslySeenFiltered > 0 && !showPreviouslySeen
              ? `All candidate videos from this search were detected in cross-search deduplication and are tagged as "Seen before". Click below to reveal them.`
              : 'Try lowering the score threshold slider or resetting keyword filters to view more candidates.'}
          </p>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
            {previouslySeenFiltered > 0 && !showPreviouslySeen && (
              <Button
                size="sm"
                variant="raspberry"
                onClick={() => setShowPreviouslySeen(true)}
              >
                Show {previouslySeenFiltered} Previously Seen Videos
              </Button>
            )}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setMinScore(50);
                setSearchQuery('');
                setSelectedPlatform('all');
              }}
            >
              Reset Filters
            </Button>
          </div>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredResults.map((result) => (
            <VideoCard
              key={result.id || result.videoId}
              result={result}
              isShortlisted={isShortlisted(result.videoId || result.id)}
              onToggleShortlist={onToggleShortlist}
              onOpenPreview={setPreviewResult}
            />
          ))}
        </div>
      )}

      {/* Video Preview Modal */}
      <VideoPreviewModal
        result={previewResult}
        isOpen={Boolean(previewResult)}
        onClose={() => setPreviewResult(null)}
      />
    </div>
  );
};
