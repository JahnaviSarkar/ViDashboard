import React from 'react';
import { Bookmark, FileSpreadsheet, FileCode, ArrowLeft } from 'lucide-react';
import { Card, Button, Badge } from '../../design-system';
import { CandidateResult } from '../../types';
import { VideoCard } from '../results/VideoCard';

export interface ShortlistViewProps {
  shortlist: CandidateResult[];
  onToggleShortlist: (result: CandidateResult) => void;
  onOpenPreview: (result: CandidateResult) => void;
  onBackToSearch: () => void;
}

export const ShortlistView: React.FC<ShortlistViewProps> = ({
  shortlist,
  onToggleShortlist,
  onOpenPreview,
  onBackToSearch,
}) => {
  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(shortlist, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `vidashboard_shortlist_${Date.now()}.json`;
    a.click();
  };

  const handleExportCSV = () => {
    const headers = ['Platform', 'VideoId', 'MatchScore', 'Evidence', 'Author', 'PostedAt', 'URL', 'Caption', 'Explanation'];
    const rows = shortlist.map((r) => [
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
    a.download = `vidashboard_shortlist_${Date.now()}.csv`;
    a.click();
  };

  return (
    <div style={{ maxWidth: '1180px', margin: '0 auto', width: '100%', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button size="sm" variant="secondary" onClick={onBackToSearch} leftIcon={<ArrowLeft size={14} />}>
            Back
          </Button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Badge variant="raspberry" icon={<Bookmark size={12} />}>
                Saved Shortlist
              </Badge>
              <span style={{ fontSize: '0.8125rem', color: 'rgba(254, 243, 199, 0.70)' }}>
                {shortlist.length} videos saved
              </span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#FFFFFF', marginTop: '2px' }}>
              Curated Video Shortlist
            </h1>
          </div>
        </div>

        {shortlist.length > 0 && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button size="sm" variant="secondary" onClick={handleExportCSV} leftIcon={<FileSpreadsheet size={14} />}>
              Export Shortlist CSV
            </Button>
            <Button size="sm" variant="secondary" onClick={handleExportJSON} leftIcon={<FileCode size={14} />}>
              Export Shortlist JSON
            </Button>
          </div>
        )}
      </div>

      {/* Grid of Shortlisted Videos */}
      {shortlist.length === 0 ? (
        <Card padding="lg" style={{ textAlign: 'center', padding: '60px 24px' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: 'rgba(242, 97, 156, 0.18)',
              border: '1px solid rgba(242, 97, 156, 0.35)',
              color: '#F2619C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 4px 16px rgba(242, 97, 156, 0.25)',
            }}
          >
            <Bookmark size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#FFFFFF', marginBottom: '8px' }}>
            Your Shortlist is Empty
          </h3>
          <p style={{ color: 'rgba(254, 243, 199, 0.70)', fontSize: '0.875rem', maxWidth: '420px', margin: '0 auto 20px' }}>
            Click the bookmark icon on any candidate video card in the discovery results to save it here for review and CSV/JSON export.
          </p>
          <Button size="md" variant="raspberry" onClick={onBackToSearch}>
            Explore Video Discovery
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
          {shortlist.map((result) => (
            <VideoCard
              key={result.id || result.videoId}
              result={result}
              isShortlisted={true}
              onToggleShortlist={onToggleShortlist}
              onOpenPreview={onOpenPreview}
            />
          ))}
        </div>
      )}
    </div>
  );
};

