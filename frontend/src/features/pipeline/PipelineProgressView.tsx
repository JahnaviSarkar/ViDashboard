import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Terminal,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, Button, Badge } from '../../design-system';
import { useSSE, PIPELINE_STAGES } from '../../hooks/useSSE';

export interface PipelineProgressViewProps {
  searchId: string;
  onCompleted: () => void;
  onCancel?: () => void;
}

export const PipelineProgressView: React.FC<PipelineProgressViewProps> = ({
  searchId,
  onCompleted,
  onCancel,
}) => {
  const { stages, events, currentStage, error, isComplete, reconnect } = useSSE(searchId);
  const [showEventLog, setShowEventLog] = useState(false);

  // Auto-complete trigger when finished
  React.useEffect(() => {
    if (isComplete) {
      const timer = setTimeout(() => {
        onCompleted();
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [isComplete, onCompleted]);

  const completedCount = Object.values(stages).filter((s) => s.status === 'done').length;
  const progressPercent = Math.round((completedCount / PIPELINE_STAGES.length) * 100);

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', width: '100%' }}>
      {/* Top Status Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Pipeline Progress ({progressPercent}%)
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {error && (
            <Button size="sm" variant="secondary" onClick={reconnect} leftIcon={<RefreshCw size={14} />}>
              Retry Connection
            </Button>
          )}
          {onCancel && !isComplete && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Back
            </Button>
          )}
          {isComplete && (
            <Button size="md" variant="raspberry" onClick={onCompleted} rightIcon={<ArrowRight size={16} />}>
              View Results
            </Button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: 'var(--bg-subtle)',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          marginBottom: '28px',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            backgroundColor: isComplete ? 'var(--success)' : 'var(--primary)',
            transition: 'width 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </div>

      {/* 10-Stage Stepper List */}
      <Card padding="none" style={{ marginBottom: '24px', overflow: 'hidden' }}>
        {PIPELINE_STAGES.map((item, index) => {
          const stageState = stages[item.stage];
          const isCurrent = currentStage === item.stage && stageState.status === 'running';
          const isDone = stageState.status === 'done';
          const isFailed = stageState.status === 'failed';

          return (
            <div
              key={item.stage}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 20px',
                borderBottom: index < PIPELINE_STAGES.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                backgroundColor: isCurrent ? 'var(--primary-subtle)' : 'transparent',
                transition: 'background-color 0.2s ease',
              }}
            >
              {/* Status Icon */}
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px',
                  flexShrink: 0,
                  backgroundColor: isDone
                    ? 'var(--success-subtle)'
                    : isFailed
                    ? 'var(--danger-subtle)'
                    : isCurrent
                    ? 'var(--bg-card)'
                    : 'var(--bg-subtle)',
                  color: isDone
                    ? 'var(--success)'
                    : isFailed
                    ? 'var(--danger)'
                    : isCurrent
                    ? 'var(--primary)'
                    : 'var(--text-muted)',
                  border: isCurrent ? '2px solid var(--primary)' : 'none',
                }}
              >
                {isDone ? (
                  <CheckCircle2 size={18} />
                ) : isFailed ? (
                  <AlertCircle size={18} />
                ) : isCurrent ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <span style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{index + 1}</span>
                )}
              </div>

              {/* Stage Details */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontWeight: isCurrent || isDone ? 700 : 500,
                      color: isDone
                        ? 'var(--text-primary)'
                        : isCurrent
                        ? 'var(--primary-text)'
                        : isFailed
                        ? 'var(--danger-text)'
                        : 'var(--text-muted)',
                      fontSize: '0.9375rem',
                    }}
                  >
                    {item.label}
                  </span>
                  {stageState.payload?.message && isCurrent && (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--primary)', fontStyle: 'italic' }}>
                      — {stageState.payload.message}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {item.description}
                </div>
              </div>

              {/* Summary / Duration Pill */}
              <div style={{ marginLeft: '16px', textAlign: 'right', flexShrink: 0 }}>
                {stageState.durationMs !== undefined && (
                  <span
                    style={{
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <Clock size={12} />
                    {stageState.durationMs > 1000
                      ? `${(stageState.durationMs / 1000).toFixed(1)}s`
                      : `${stageState.durationMs}ms`}
                  </span>
                )}

                {/* Specific Stage Payload Stats */}
                {item.stage === 'fetching_instagram' && stageState.payload?.usable !== undefined && (
                  <Badge size="sm" variant="lilac">
                    {stageState.payload.usable} Reels
                  </Badge>
                )}
                {item.stage === 'fetching_meta' && stageState.payload?.usable !== undefined && (
                  <Badge size="sm" variant="blueberry">
                    {stageState.payload.usable} Ads
                  </Badge>
                )}
                {item.stage === 'removing_duplicates' && stageState.payload?.duplicatesRemoved !== undefined && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    -{stageState.payload.duplicatesRemoved} duplicates
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Real-time SSE Raw Event Log Toggle */}
      <div style={{ marginTop: '16px' }}>
        <button
          type="button"
          onClick={() => setShowEventLog((v) => !v)}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 0',
          }}
        >
          <Terminal size={16} />
          <span>Real-time Event Stream Log ({events.length} events)</span>
          {showEventLog ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showEventLog && (
          <Card
            padding="sm"
            style={{
              marginTop: '12px',
              backgroundColor: '#0f172a',
              color: '#38bdf8',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              maxHeight: '220px',
              overflowY: 'auto',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {events.length === 0 ? (
              <div style={{ color: '#64748b', padding: '8px' }}>Waiting for incoming SSE events...</div>
            ) : (
              events.map((ev, i) => (
                <div key={i} style={{ padding: '3px 6px', borderBottom: '1px solid #1e293b' }}>
                  <span style={{ color: '#94a3b8' }}>[{new Date(ev.createdAt).toLocaleTimeString()}]</span>{' '}
                  <span style={{ color: '#f59e0b', fontWeight: 600 }}>{ev.stage}</span>{' '}
                  <span style={{ color: ev.status === 'done' ? '#10b981' : ev.status === 'failed' ? '#ef4444' : '#60a5fa' }}>
                    {ev.status.toUpperCase()}
                  </span>
                  {ev.payload?.message && (
                    <span style={{ color: '#cbd5e1' }}> : {ev.payload.message}</span>
                  )}
                </div>
              ))
            )}
          </Card>
        )}
      </div>
    </div>
  );
};
