import React from 'react';
import {
  Instagram,
  Flame,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
  Film,
  Camera,
  FileText,
  Bookmark,
  History,
} from 'lucide-react';
import { Card, Badge, Popover } from '../../design-system';
import { CandidateResult } from '../../types';

export interface VideoCardProps {
  result: CandidateResult;
  onOpenPreview: (result: CandidateResult) => void;
  isShortlisted?: boolean;
  onToggleShortlist?: (result: CandidateResult) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({
  result,
  onOpenPreview,
  isShortlisted = false,
  onToggleShortlist,
}) => {
  const { video, matchScore, scoreBreakdown, explanation, previouslySeen } = result;
  const isInstagram = video.platform === 'instagram';

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10B981';
    if (score >= 60) return '#F59E0B';
    return '#EF4444';
  };

  const getEvidenceBadge = (evidence?: string) => {
    switch (evidence) {
      case 'frames':
        return (
          <Badge size="sm" variant="lilac" icon={<Film size={11} />}>
            frames
          </Badge>
        );
      case 'thumbnail':
        return (
          <Badge size="sm" variant="blueberry" icon={<Camera size={11} />}>
            thumbnail
          </Badge>
        );
      case 'caption_only':
      default:
        return (
          <Badge size="sm" variant="lemon" icon={<FileText size={11} />}>
            caption_only
          </Badge>
        );
    }
  };

  const getVerdictIcon = (verdict?: string) => {
    switch (verdict) {
      case 'match':
        return <CheckCircle2 size={13} color="#10B981" />;
      case 'partial':
        return <AlertTriangle size={13} color="#F59E0B" />;
      case 'mismatch':
        return <XCircle size={13} color="#EF4444" />;
      default:
        return <Info size={13} color="#77717F" />;
    }
  };

  // Why this matched Popover content
  const popoverContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: '0.875rem', color: '#292633' }}>
          Visual Evidence & Rubric
        </span>
        <span
          style={{
            fontSize: '0.8125rem',
            fontWeight: 800,
            padding: '2px 8px',
            borderRadius: 'var(--radius-pill)',
            backgroundColor: matchScore >= 60 ? '#D1FAE5' : '#FEE2E2',
            color: matchScore >= 60 ? '#065F46' : '#991B1B',
          }}
        >
          {matchScore}% Match
        </span>
      </div>

      {/* Visual Explanation */}
      <div
        style={{
          padding: '8px 10px',
          backgroundColor: '#FAF8F7',
          borderRadius: '10px',
          fontSize: '0.8125rem',
          lineHeight: 1.45,
          color: '#292633',
          borderLeft: `3px solid ${getScoreColor(matchScore)}`,
        }}
      >
        <span style={{ fontWeight: 700, display: 'block', marginBottom: '2px', color: '#77717F', fontSize: '0.75rem' }}>
          Grounding Citation:
        </span>
        {explanation || 'Evaluated against target product visual silhouette.'}
      </div>

      {/* Attribute Verdicts */}
      {scoreBreakdown?.attributeVerdicts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 800, color: '#77717F', textTransform: 'uppercase' }}>
            Attribute Verdicts
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {Object.entries(scoreBreakdown.attributeVerdicts).map(([key, val]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.75rem',
                  padding: '4px 6px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '6px',
                  border: '1px solid #E9E3ED',
                }}
              >
                {getVerdictIcon(val)}
                <span style={{ textTransform: 'capitalize', color: '#77717F', flex: 1 }}>
                  {key.replace(/([A-Z])/g, ' $1')}
                </span>
                <span style={{ fontWeight: 700, color: '#292633' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Math Breakdown */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.6875rem',
          color: '#77717F',
          paddingTop: '6px',
          borderTop: '1px solid #E9E3ED',
        }}
      >
        <span>Cosine: {scoreBreakdown?.embeddingScore ?? 0}%</span>
        <span>Rubric: {scoreBreakdown?.rubricScore ?? 0}%</span>
        <span>Bonus: +{scoreBreakdown?.bonuses ?? 0}</span>
        <span>Penalty: -{scoreBreakdown?.penalties ?? 0}</span>
      </div>
    </div>
  );

  return (
    <Card
      padding="none"
      hoverable
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        cursor: 'pointer',
        borderRadius: '20px',
        border: '1px solid #E9E3ED',
        overflow: 'hidden',
        boxShadow: '0 4px 18px rgba(147, 171, 217, 0.12)',
      }}
      onClick={() => onOpenPreview(result)}
    >
      {/* 9:16 Aspect Ratio Video Reel Thumbnail */}
      <div style={{ position: 'relative', width: '100%', aspectRatio: '9 / 16', backgroundColor: '#FAF8F7', overflow: 'hidden' }}>
        {video.thumbnailUrl ? (
          <img
            src={video.thumbnailUrl}
            alt={video.caption || 'Video thumbnail'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#93ABD9',
              backgroundColor: '#F5F2F7',
            }}
          >
            <Camera size={36} />
          </div>
        )}

        {/* Top Floating Badges: Evidence + Previously Seen + Shortlist */}
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            right: '10px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 2,
          }}
        >
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {getEvidenceBadge(scoreBreakdown?.evidence)}
            {previouslySeen && (
              <Badge size="sm" variant="lemon" icon={<History size={11} />}>
                Seen before
              </Badge>
            )}
          </div>

          {/* Shortlist Bookmark Button */}
          {onToggleShortlist && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleShortlist(result);
              }}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: isShortlisted ? '#F2619C' : 'rgba(255, 255, 255, 0.9)',
                color: isShortlisted ? '#FFFFFF' : '#77717F',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                transition: 'all 0.15s ease',
              }}
              title={isShortlisted ? 'Remove from shortlist' : 'Save to shortlist'}
            >
              <Bookmark size={15} fill={isShortlisted ? '#FFFFFF' : 'none'} />
            </button>
          )}
        </div>

        {/* Match Score Badge (Pill) */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(4px)',
            borderRadius: 'var(--radius-pill)',
            padding: '3px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: getScoreColor(matchScore) }}>
            {matchScore}%
          </span>
          <span style={{ fontSize: '0.6875rem', color: '#77717F', fontWeight: 700 }}>
            Match
          </span>
        </div>
      </div>

      {/* Caption snippet area */}
      <div style={{ padding: '12px 16px 8px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <p
          style={{
            fontSize: '0.8125rem',
            color: '#292633',
            lineHeight: 1.45,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            margin: 0,
            flex: 1,
          }}
        >
          {video.caption || 'No caption text.'}
        </p>
      </div>

      {/* A-Toys Coloured Bottom Section for Platform & Score Area */}
      <div
        style={{
          padding: '10px 16px',
          backgroundColor: isInstagram ? '#F8EEFC' : '#EBF1F9',
          borderTop: `1px solid ${isInstagram ? '#E7BEF8' : '#93ABD9'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'auto',
        }}
      >
        {/* Platform & Creator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '60%', overflow: 'hidden' }}>
          {isInstagram ? <Instagram size={14} color="#E1306C" /> : <Flame size={14} color="#0064E0" />}
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: isInstagram ? '#6B2B85' : '#314F85',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {video.author || (isInstagram ? 'Reel' : 'Ad')}
          </span>
        </div>

        {/* Action icons: Why this matched popover & External Link */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
          <Popover
            trigger={
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '0.75rem',
                  color: isInstagram ? '#6B2B85' : '#314F85',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                <Info size={13} />
                <span>Rubric</span>
              </div>
            }
            content={popoverContent}
          />

          <a
            href={video.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#77717F', display: 'flex', padding: '2px' }}
            title="Open original video"
          >
            <ExternalLink size={13} />
          </a>
        </div>
      </div>
    </Card>
  );
};
