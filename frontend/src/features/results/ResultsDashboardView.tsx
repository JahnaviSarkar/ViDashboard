import React, { useState, useMemo } from 'react';
import {
  Search as SearchIcon,
  RotateCcw,
  Sparkles,
  Instagram,
  Flame,
  FileSpreadsheet,
  FileCode,
  Tag,
  Palette,
  AlertTriangle,
} from 'lucide-react';
import { Card, Button, Badge, Input, Slider, Tabs } from '../../design-system';
import { SearchDetails, CandidateResult } from '../../types';
import { VideoCard } from './VideoCard';
import { VideoPreviewModal } from './VideoPreviewModal';

export interface ResultsDashboardViewProps {
  searchDetails: SearchDetails;
  onNewSearch: () => void;
}

export const ResultsDashboardView: React.FC<ResultsDashboardViewProps> = ({
  searchDetails,
  onNewSearch,
}) => {
  const { product, analysis, sourceRuns, results, search } = searchDetails;

  // Filter & Search states
  const [selectedSource, setSelectedSource] = useState<'all' | 'instagram' | 'meta'>('all');
  const [minScore, setMinScore] = useState<number>(search.minMatchThreshold || 60);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'date'>('score');

  // Preview modal state
  const [previewResult, setPreviewResult] = useState<CandidateResult | null>(null);

  // Filtered and sorted results
  const filteredResults = useMemo(() => {
    return results.filter((item) => {
      // Source filter
      if (selectedSource !== 'all' && item.video.platform !== selectedSource) {
        return false;
      }
      // Min score filter
      if (item.matchScore < minScore) {
        return false;
      }
      // Search text query
      if (searchQuery.trim()) {
        const text = `${item.video.caption || ''} ${item.video.author || ''} ${item.video.platformVideoId}`.toLowerCase();
        if (!text.includes(searchQuery.toLowerCase())) {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      if (sortBy === 'score') {
        return b.matchScore - a.matchScore;
      }
      const dateA = a.video.postedAt ? new Date(a.video.postedAt).getTime() : 0;
      const dateB = b.video.postedAt ? new Date(b.video.postedAt).getTime() : 0;
      return dateB - dateA;
    });
  }, [results, selectedSource, minScore, searchQuery, sortBy]);

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
      r.scoreBreakdown.evidence || '',
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

  // Source stats
  const igRun = sourceRuns.find((r) => r.source === 'instagram');
  const metaRun = sourceRuns.find((r) => r.source === 'meta');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <Badge variant="success">Discovery Completed</Badge>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              ID: {search.id.slice(0, 8)}
            </span>
          </div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Video Match Intelligence Dashboard
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button size="sm" variant="secondary" onClick={handleExportCSV} leftIcon={<FileSpreadsheet size={14} />}>
            Export CSV
          </Button>
          <Button size="sm" variant="secondary" onClick={handleExportJSON} leftIcon={<FileCode size={14} />}>
            Export JSON
          </Button>
          <Button size="sm" variant="primary" onClick={onNewSearch} leftIcon={<RotateCcw size={14} />}>
            New Search
          </Button>
        </div>
      </div>

      {/* Target Product Summary Card */}
      {product && (
        <Card padding="md" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.title}
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: 'var(--radius-md)',
                  objectFit: 'contain',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-subtle)',
                }}
              />
            )}

            <div style={{ flex: 1, minWidth: '240px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                {product.brand && (
                  <Badge variant="info">
                    {product.brand}
                  </Badge>
                )}
                {product.category && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {product.category}
                  </span>
                )}
              </div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                {product.title}
              </h2>
              {product.price && (
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--success)' }}>
                  {product.currency || ''} {product.price}
                </div>
              )}
            </div>

            {/* Analysis Attributes Swatches */}
            {analysis?.attributes && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '380px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Extracted Image Attributes (Image Brain)
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {analysis.attributes.productType && (
                    <Badge size="sm" variant="default" icon={<Tag size={12} />}>
                      {analysis.attributes.productType}
                    </Badge>
                  )}
                  {analysis.attributes.dominantColour && (
                    <Badge size="sm" variant="default" icon={<Palette size={12} />}>
                      {analysis.attributes.dominantColour}
                    </Badge>
                  )}
                  {analysis.attributes.material && (
                    <Badge size="sm" variant="default">
                      {analysis.attributes.material}
                    </Badge>
                  )}
                  {analysis.attributes.shape && (
                    <Badge size="sm" variant="default">
                      {analysis.attributes.shape}
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Source Runs Breakdown Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Instagram Run */}
        <Card padding="sm" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--instagram-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Instagram size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Instagram Reels
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {igRun ? `${igRun.usable} usable / ${igRun.collected} collected` : 'No run recorded'}
            </div>
          </div>
          {igRun?.shortfall !== undefined && igRun.shortfall > 0 ? (
            <Badge size="sm" variant="warning">
              -{igRun.shortfall} Shortfall
            </Badge>
          ) : (
            <Badge size="sm" variant="success">
              Goal Reached
            </Badge>
          )}
        </Card>

        {/* Meta Ads Run */}
        <Card padding="sm" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--meta-blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            <Flame size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Meta Ad Library
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {metaRun ? `${metaRun.usable} usable / ${metaRun.collected} collected` : 'No run recorded'}
            </div>
          </div>
          {metaRun?.shortfall !== undefined && metaRun.shortfall > 0 ? (
            <Badge size="sm" variant="warning">
              -{metaRun.shortfall} Shortfall
            </Badge>
          ) : (
            <Badge size="sm" variant="success">
              Goal Reached
            </Badge>
          )}
        </Card>

        {/* Matches Above Threshold */}
        <Card padding="sm" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--primary-subtle)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Sparkles size={20} />
          </div>
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Above Threshold Matches
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {filteredResults.length} displaying / {results.length} total scored
            </div>
          </div>
        </Card>
      </div>

      {/* Control & Filter Toolbar */}
      <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Source Tabs */}
          <Tabs
            tabs={[
              { id: 'all', label: 'All Sources', badge: results.length },
              { id: 'instagram', label: 'Instagram Reels', badge: results.filter((r) => r.video.platform === 'instagram').length },
              { id: 'meta', label: 'Meta Ads', badge: results.filter((r) => r.video.platform === 'meta').length },
            ]}
            activeTab={selectedSource}
            onChange={(id) => setSelectedSource(id as any)}
          />

          {/* Sort Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>Sort By:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                padding: '6px 12px',
                fontSize: '0.8125rem',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="score">Highest Match Score</option>
              <option value="date">Newest First</option>
            </select>
          </div>
        </div>

        {/* Search Query and Match Slider Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'center' }}>
          <Input
            placeholder="Search keywords, authors, or captions in results..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<SearchIcon size={16} />}
          />

          <Slider
            label="Filter Match Threshold"
            value={minScore}
            min={40}
            max={90}
            step={5}
            onChange={setMinScore}
            helperText={`Showing candidates scoring >= ${minScore}%`}
          />
        </div>
      </Card>

      {/* Video Cards Grid */}
      {filteredResults.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '12px' }}>
            <AlertTriangle size={36} style={{ margin: '0 auto' }} />
          </div>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
            No matching videos found
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto 16px' }}>
            Try lowering the minimum score threshold slider (e.g. to 50%) or clearing the keyword search filter.
          </p>
          <Button size="sm" variant="outline" onClick={() => { setMinScore(50); setSearchQuery(''); }}>
            Reset Filters
          </Button>
        </Card>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
            gap: '20px',
          }}
        >
          {filteredResults.map((result) => (
            <VideoCard
              key={result.id || result.videoId}
              result={result}
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
