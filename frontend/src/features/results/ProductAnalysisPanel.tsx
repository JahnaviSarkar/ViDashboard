import React from 'react';
import { Tag, Palette, Sparkles, Hash, Search as SearchIcon, ExternalLink } from 'lucide-react';
import { Card, Badge } from '../../design-system';
import { ProductDetails, ProductAnalysis } from '../../types';

export interface ProductAnalysisPanelProps {
  product?: ProductDetails | null;
  analysis?: {
    attributes: ProductAnalysis;
    queries?: Record<string, any>;
    hashtags?: string[];
    provider?: string;
  } | null;
}

export const ProductAnalysisPanel: React.FC<ProductAnalysisPanelProps> = ({ product, analysis }) => {
  if (!product && !analysis) return null;

  const attrs = analysis?.attributes;
  const queries = analysis?.queries;
  const hashtags = analysis?.hashtags || [];

  return (
    <Card padding="md" style={{ border: '1px solid #E9E3ED', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Product Image */}
        {product?.imageUrl && (
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '16px',
              overflow: 'hidden',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E9E3ED',
              flexShrink: 0,
              boxShadow: '0 2px 8px rgba(147, 171, 217, 0.1)',
            }}
          >
            <img
              src={product.imageUrl}
              alt={product.title}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          </div>
        )}

        {/* Title, Brand, Price */}
        <div style={{ flex: 1, minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {product?.brand && (
              <Badge variant="raspberry">
                {product.brand}
              </Badge>
            )}
            {product?.category && (
              <span style={{ fontSize: '0.75rem', color: '#77717F' }}>
                {product.category}
              </span>
            )}
            {product?.canonicalUrl && (
              <a
                href={product.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#77717F', display: 'inline-flex', alignItems: 'center', gap: '2px', textDecoration: 'none' }}
              >
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#292633', lineHeight: 1.3, marginBottom: '6px' }}>
            {product?.title || 'Resolved Product'}
          </h2>

          {product?.price && (
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#10B981' }}>
              {product.currency || ''} {product.price}
            </div>
          )}
        </div>

        {/* Image Brain Attributes Chips */}
        {attrs && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '420px', flex: 1 }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#77717F', textTransform: 'uppercase' }}>
              Image Brain Visual Attributes
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {attrs.productType && (
                <Badge size="sm" variant="lilac" icon={<Tag size={12} />}>
                  {attrs.productType}
                </Badge>
              )}
              {attrs.dominantColour && (
                <Badge size="sm" variant="blueberry" icon={<Palette size={12} />}>
                  {attrs.dominantColour}
                </Badge>
              )}
              {attrs.material && (
                <Badge size="sm" variant="neutral">
                  {attrs.material}
                </Badge>
              )}
              {attrs.shape && (
                <Badge size="sm" variant="neutral">
                  {attrs.shape}
                </Badge>
              )}
              {attrs.logos && attrs.logos.length > 0 && (
                <Badge size="sm" variant="lemon" icon={<Sparkles size={12} />}>
                  Logo: {attrs.logos.join(', ')}
                </Badge>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Generated Queries & Hashtags */}
      {(queries || hashtags.length > 0) && (
        <div
          style={{
            paddingTop: '12px',
            borderTop: '1px solid #E9E3ED',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#77717F', textTransform: 'uppercase' }}>
            Generated Search Queries & Hashtags
          </span>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {hashtags.slice(0, 6).map((tag, idx) => (
              <Badge key={idx} size="sm" variant="lilac" icon={<Hash size={11} />}>
                {tag.replace(/^#/, '')}
              </Badge>
            ))}

            {queries?.meta?.searchTerms &&
              queries.meta.searchTerms.slice(0, 4).map((term: string, idx: number) => (
                <Badge key={`meta_${idx}`} size="sm" variant="blueberry" icon={<SearchIcon size={11} />}>
                  {term}
                </Badge>
              ))}
          </div>
        </div>
      )}
    </Card>
  );
};

