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
  User,
  Calendar,
} from 'lucide-react';
import { Card, Badge, Popover } from '../../design-system';
import { CandidateResult } from '../../types';

export interface VideoCardProps {
  result: CandidateResult;
  onOpenPreview: (result: CandidateResult) => void;
}

export const VideoCard: React.FC<VideoCardProps> = ({ result, onOpenPreview }) => {
  const { video, matchScore, scoreBreakdown, explanation, belowThreshold } = result;
  const isInstagram = video.platform === 'instagram';

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'var(--success)';
    if (score >= 60) return 'var(--warning)';
    return 'var(--danger)';
  };

  const getScoreBg = (score: number) => {
    if (score >= 80) return 'var(--success-subtle)';
    if (score >= 60) return 'var(--warning-subtle)';
    return 'var(--danger-subtle)';
  };

  const getEvidenceIcon = (evidence?: string) => {
    switch (evidence) {
      case 'frames':
        return <Film size={12} />;
      case 'thumbnail':
        return <Camera size={12} />;
      case 'caption_only':
      default:
        return <FileText size={12} />;
    }
  };

  const getVerdictIcon = (verdict?: string) => {
    switch (verdict) {
      case 'match':
        return <CheckCircle2 size={13} color="var(--success)" />;
      case 'partial':
        return <AlertTriangle size={13} color="var(--warning)" />;
      case 'mismatch':
        return <XCircle size={13} color="var(--danger)" />;
      default:
        return <Info size={13} color="var(--text-muted)" />;
    }
  };

  // Why this matched Popover content
  const popoverContent = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
          Match Rubric & Visual Evidence
        </span>
        <Badge
          size="sm"
          style={{
            backgroundColor: getScoreBg(matchScore),
            color: getScoreColor(matchScore),
            fontWeight: 800,
          }}
        >
          {matchScore}% Match
        </Badge>
      </div>

      {/* Visual Evidence Citation */}
      <div
        style={{
          padding: '8px 10px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8125rem',
          lineHeight: 1.4,
          color: 'var(--text-secondary)',
          borderLeft: `3px solid ${getScoreColor(matchScore)}`,
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '2px' }}>
          Visual Citation:
        </span>
        {explanation || 'Evaluated against target product visual silhouette and attributes.'}
      </div>

      {/* Attribute Verdict Matrix */}
      {scoreBreakdown.attributeVerdicts && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
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
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {getVerdictIcon(val)}
                <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)', flex: 1 }}>
                  {key.replace(/([A-Z])/g, ' $1')}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scoring Math Breakdown */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          paddingTop: '6px',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <span>Cosine: {scoreBreakdown.embeddingScore ?? 0}%</span>
        <span>Rubric: {scoreBreakdown.rubricScore ?? 0}%</span>
        <span>Bonus: +{scoreBreakdown.bonuses ?? 0}</span>
        <span>Penalty: -{scoreBreakdown.penalties ?? 0}</span>
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
        border: belowThreshold ? '1px dashed var(--danger)' : '1px solid var(--border-subtle)',
      }}
      onClick={() => onOpenPreview(result)}
    >
      {/* Thumbnail Banner */}
      <div style={{ position: 'relative', width: '100%', paddingTop: '100%', backgroundColor: '#000' }}>
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
              // Fallback placeholder
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
              color: 'var(--text-muted)',
              backgroundColor: 'var(--bg-subtle)',
            }}
          >
            <Camera size={36} />
          </div>
        )}

        {/* Top Badges: Platform & Evidence */}
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
          <Badge
            size="sm"
            variant={isInstagram ? 'instagram' : 'meta'}
            icon={isInstagram ? <Instagram size={12} /> : <Flame size={12} />}
          >
            {isInstagram ? 'Reels' : 'Meta Ad'}
          </Badge>

          {scoreBreakdown.evidence && (
            <Badge
              size="sm"
              variant={scoreBreakdown.evidence}
              icon={getEvidenceIcon(scoreBreakdown.evidence)}
            >
              {scoreBreakdown.evidence.replace('_', ' ')}
            </Badge>
          )}
        </div>

        {/* Bottom Score Badge */}
        <div
          style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(4px)',
            borderRadius: 'var(--radius-md)',
            padding: '4px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            border: `1px solid ${getScoreColor(matchScore)}`,
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: '0.875rem', fontWeight: 800, color: getScoreColor(matchScore) }}>
            {matchScore}%
          </span>
          <span style={{ fontSize: '0.6875rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>
            Match
          </span>
        </div>
      </div>

      {/* Card Content Area */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', flex: 1, gap: '8px' }}>
        {/* Author & Date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', maxWidth: '65%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <User size={12} />
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{video.author || 'Creator'}</span>
          </div>
          {video.postedAt && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={12} />
              <span>{new Date(video.postedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Caption Snippet */}
        <p
          style={{
            fontSize: '0.8125rem',
            color: 'var(--text-primary)',
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            flex: 1,
            margin: 0,
          }}
        >
          {video.caption || 'No caption text provided.'}
        </p>

        {/* Why this matched popover trigger */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: '8px',
            borderTop: '1px solid var(--border-subtle)',
            marginTop: 'auto',
          }}
          onClick={(e) => e.stopPropagation()} // don't open modal when clicking popover trigger
        >
          <Popover trigger={
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
              <Info size={13} />
              Why this matched
            </div>
          } content={popoverContent} />

          <a
            href={video.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              padding: '2px',
            }}
            title="Open in platform"
          >
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </Card>
  );
};
