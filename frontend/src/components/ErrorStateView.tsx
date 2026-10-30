import React from 'react';
import { AlertCircle, RefreshCw, ArrowLeft, HelpCircle } from 'lucide-react';
import { Card, Button, Badge } from '../design-system';

export type ErrorType =
  | 'PRODUCT_EXTRACTION_FAILED'
  | 'COLLECTION_FAILED'
  | 'INSUFFICIENT_RESULTS'
  | 'ANALYSIS_FAILED'
  | 'TIMEOUT'
  | 'GENERIC_ERROR';

export interface ErrorStateViewProps {
  errorType?: ErrorType;
  message?: string;
  onRetry: () => void;
  onBack: () => void;
}

export const ErrorStateView: React.FC<ErrorStateViewProps> = ({
  errorType = 'GENERIC_ERROR',
  message,
  onRetry,
  onBack,
}) => {
  const getErrorDetails = () => {
    switch (errorType) {
      case 'PRODUCT_EXTRACTION_FAILED':
        return {
          title: 'Product URL Extraction Failed',
          badgeText: 'Extraction Error',
          badgeVariant: 'danger' as const,
          description: message || 'Unable to parse valid product signals, JSON-LD microdata, or OpenGraph images from the provided URL.',
          nextSteps: [
            'Verify that the URL points directly to an individual product item page (not a category or collection).',
            'Ensure the product page is public and does not require login, captcha, or geo-blocking.',
            'Alternatively, try searching by product name or brand keywords using the text search tab.',
          ],
        };
      case 'COLLECTION_FAILED':
        return {
          title: 'Social Platform Collection Error',
          badgeText: 'Collector Access Failure',
          badgeVariant: 'warning' as const,
          description: message || 'Failed to retrieve video candidates from Instagram Reels or Meta Ad Library API.',
          nextSteps: [
            'Check your network connection and verify APIFY_TOKEN or Meta tokens in .env.',
            'The platform rate limits may be temporarily triggered; retry after a 30-second cooldown.',
            'Ensure your search terms or hashtags are not restricted on social platforms.',
          ],
        };
      case 'INSUFFICIENT_RESULTS':
        return {
          title: 'Insufficient Video Results Found',
          badgeText: 'Low Candidate Yield',
          badgeVariant: 'warning' as const,
          description: message || 'The search queries returned fewer than the target threshold of usable video candidates.',
          nextSteps: [
            'Try broader search queries or remove niche hashtags to expand candidate retrieval.',
            'Lower the minimum match threshold slider (e.g. to 50%) to admit more candidates.',
            'Enable both Instagram Reels and Meta Ad Library to aggregate from multiple platform feeds.',
          ],
        };
      case 'ANALYSIS_FAILED':
        return {
          title: 'Image Brain Vision Analysis Error',
          badgeText: 'Vision Provider Failure',
          badgeVariant: 'danger' as const,
          description: message || 'The multimodal Image Brain was unable to extract visual attributes from the product image.',
          nextSteps: [
            'Verify your GEMINI_API_KEY in .env and check that your model quota is active.',
            'Ensure the product image format is a valid JPEG, PNG, or WebP under 10MB.',
            'Retry the search or upload a cleaner reference image with a clear foreground silhouette.',
          ],
        };
      case 'TIMEOUT':
        return {
          title: 'Pipeline Network Timeout',
          badgeText: 'Connection Timeout',
          badgeVariant: 'warning' as const,
          description: message || 'The discovery pipeline exceeded the execution time limit while waiting for platform scrapers.',
          nextSteps: [
            'Check your internet connection and proxy latency.',
            'Verify the Apify Actor run timeout settings in your backend configuration.',
            'Click Retry to re-run the discovery pipeline with cached product microdata.',
          ],
        };
      default:
        return {
          title: 'Search Pipeline Error',
          badgeText: 'Pipeline Exception',
          badgeVariant: 'danger' as const,
          description: message || 'An unexpected error interrupted the product discovery pipeline.',
          nextSteps: [
            'Verify backend server status at http://localhost:3001/api/health.',
            'Check the server terminal log for structured error traces.',
            'Click Retry to restart the discovery pipeline.',
          ],
        };
    }
  };

  const details = getErrorDetails();

  return (
    <div style={{ maxWidth: '680px', margin: '40px auto', width: '100%' }}>
      <Card padding="lg" style={{ border: '1.5px solid #FCA5A5', boxShadow: '0 8px 30px rgba(239, 68, 68, 0.12)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: '#FEE2E2',
                color: '#EF4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <AlertCircle size={24} />
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <Badge variant={details.badgeVariant}>
                  {details.badgeText}
                </Badge>
              </div>
              <h2 style={{ fontSize: '1.375rem', fontWeight: 800, color: '#292633', margin: 0 }}>
                {details.title}
              </h2>
            </div>
          </div>

          {/* Error Description Box */}
          <div
            style={{
              padding: '12px 16px',
              backgroundColor: '#FAF8F7',
              borderRadius: '12px',
              border: '1px solid #E9E3ED',
              fontSize: '0.875rem',
              color: '#292633',
              lineHeight: 1.5,
            }}
          >
            <strong>What went wrong:</strong> {details.description}
          </div>

          {/* Actionable Suggestions */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', fontWeight: 700, color: '#77717F', marginBottom: '8px' }}>
              <HelpCircle size={14} color="#93ABD9" />
              <span>What to try next:</span>
            </div>

            <ul style={{ margin: 0, paddingLeft: '22px', fontSize: '0.8125rem', color: '#77717F', lineHeight: 1.6 }}>
              {details.nextSteps.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ul>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', paddingTop: '12px', borderTop: '1px solid #E9E3ED' }}>
            <Button
              variant="secondary"
              size="md"
              onClick={onBack}
              leftIcon={<ArrowLeft size={16} />}
            >
              Back to Search
            </Button>

            <Button
              variant="raspberry"
              size="md"
              onClick={onRetry}
              leftIcon={<RefreshCw size={16} />}
              style={{ flex: 1 }}
            >
              Retry Discovery
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

