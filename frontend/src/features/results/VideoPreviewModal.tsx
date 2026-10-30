import React, { useState } from 'react';
import {
  ExternalLink,
  Instagram,
  Flame,
  User,
  Calendar,
  Copy,
  Check,
  Camera,
} from 'lucide-react';
import { Modal, Badge, Button } from '../../design-system';
import { CandidateResult } from '../../types';

export interface VideoPreviewModalProps {
  result: CandidateResult | null;
  isOpen: boolean;
  onClose: () => void;
}

export const VideoPreviewModal: React.FC<VideoPreviewModalProps> = ({
  result,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState(0);

  if (!result) return null;

  const { video, matchScore, explanation } = result;
  const isInstagram = video.platform === 'instagram';

  const handleCopyId = () => {
    navigator.clipboard.writeText(video.platformVideoId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const frames = video.framePaths && video.framePaths.length > 0
    ? video.framePaths
    : video.thumbnailUrl
    ? [video.thumbnailUrl]
    : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="780px"
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge
            variant={isInstagram ? 'instagram' : 'meta'}
            icon={isInstagram ? <Instagram size={14} /> : <Flame size={14} />}
          >
            {isInstagram ? 'Instagram Reel' : 'Meta Ad Library'}
          </Badge>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Video ID: {video.platformVideoId}
          </span>
        </div>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '24px' }}>
        {/* Left Column: Media / Frames Player */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div
            style={{
              position: 'relative',
              width: '100%',
              aspectRatio: '9/16',
              maxHeight: '420px',
              backgroundColor: '#000',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {video.mediaUrl && video.mediaUrl.endsWith('.mp4') ? (
              <video
                src={video.mediaUrl}
                controls
                autoPlay
                muted
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : frames.length > 0 ? (
              <img
                src={frames[activeFrameIndex]}
                alt="Video frame"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <Camera size={48} color="#64748b" />
            )}

            {/* Score Overlay */}
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(4px)',
                borderRadius: 'var(--radius-md)',
                padding: '4px 10px',
                color: matchScore >= 60 ? 'var(--success)' : 'var(--danger)',
                fontWeight: 800,
                fontSize: '0.9375rem',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            >
              {matchScore}% Match
            </div>
          </div>

          {/* Extracted Frames Thumbnails */}
          {frames.length > 1 && (
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {frames.map((frame, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveFrameIndex(idx)}
                  style={{
                    width: '60px',
                    height: '60px',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    border: activeFrameIndex === idx ? '2px solid var(--primary)' : '1px solid var(--border-subtle)',
                    padding: 0,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <img src={frame} alt={`Frame ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Metadata & Rubric */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Author & Stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <User size={16} color="var(--text-muted)" />
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{video.author || 'Creator'}</span>
            </div>
            {video.postedAt && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                <Calendar size={14} />
                <span>{new Date(video.postedAt).toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* Visual Evidence Citation */}
          <div
            style={{
              padding: '12px',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-md)',
              borderLeft: '4px solid var(--primary)',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '4px' }}>
              Visual Grounding Explanation
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0 }}>
              {explanation}
            </p>
          </div>

          {/* Caption */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px' }}>
              Full Caption & Copy
            </div>
            <div
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                maxHeight: '140px',
                overflowY: 'auto',
                padding: '8px 12px',
                backgroundColor: 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              {video.caption || 'No caption text.'}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCopyId}
              leftIcon={copied ? <Check size={14} /> : <Copy size={14} />}
              style={{ flex: 1 }}
            >
              {copied ? 'Copied ID' : 'Copy ID'}
            </Button>

            <a
              href={video.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ textDecoration: 'none', flex: 1 }}
            >
              <Button
                size="sm"
                variant="primary"
                leftIcon={<ExternalLink size={14} />}
                style={{ width: '100%' }}
              >
                Open in Platform
              </Button>
            </a>
          </div>
        </div>
      </div>
    </Modal>
  );
};
