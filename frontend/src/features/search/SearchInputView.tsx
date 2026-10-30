import React, { useState, useRef } from 'react';
import {
  Link2,
  Type,
  Image as ImageIcon,
  Sparkles,
  Instagram,
  Flame,
  ArrowRight,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Card, Button, Input, Slider, Tabs, Badge } from '../../design-system';
import { createSearch, CreateSearchResponse } from '../../api/client';

export interface SearchInputViewProps {
  onSearchStarted: (searchId: string) => void;
  onOpenHistory?: () => void;
}

export const SearchInputView: React.FC<SearchInputViewProps> = ({
  onSearchStarted,
  onOpenHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'product_url' | 'keyword' | 'image_upload'>('product_url');
  const [urlInput, setUrlInput] = useState('');
  const [queryInput, setQueryInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Sources
  const [sources, setSources] = useState<Array<'instagram' | 'meta'>>(['instagram', 'meta']);
  const [minMatchThreshold, setMinMatchThreshold] = useState(60);
  const [mode, setMode] = useState<'live' | 'mock'>('live');

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSourceToggle = (source: 'instagram' | 'meta') => {
    if (sources.includes(source)) {
      if (sources.length === 1) return; // Keep at least one
      setSources(sources.filter((s) => s !== source));
    } else {
      setSources([...sources, source]);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (activeTab === 'product_url' && !urlInput.trim()) {
      setErrorMessage('Please enter a valid product webpage URL.');
      return;
    }
    if (activeTab === 'keyword' && !queryInput.trim()) {
      setErrorMessage('Please enter product search keywords or title.');
      return;
    }
    if (activeTab === 'image_upload' && !selectedImage) {
      setErrorMessage('Please choose or drop a product image file.');
      return;
    }

    try {
      setIsLoading(true);
      const res: CreateSearchResponse = await createSearch({
        inputType: activeTab,
        url: urlInput.trim() || undefined,
        query: queryInput.trim() || undefined,
        image: selectedImage || undefined,
        sources,
        minMatchThreshold,
        mode,
      });

      onSearchStarted(res.searchId);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start video search discovery.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Demo Pills
  const handleQuickDemo = (type: 'fenty' | 'represent' | 'anker') => {
    setActiveTab('product_url');
    if (type === 'fenty') {
      setUrlInput('https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow');
    } else if (type === 'represent') {
      setUrlInput('https://representclo.com/products/247-oversized-tank-black');
    } else if (type === 'anker') {
      setUrlInput('https://www.anker.com/products/a1647-power-bank');
    }
  };

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', width: '100%' }}>
      {/* Header Banner */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Badge variant="blueberry" icon={<Sparkles size={14} />}>
            Multimodal AI Discovery Engine
          </Badge>
          <button
            onClick={() => setMode((m) => (m === 'live' ? 'mock' : 'live'))}
            style={{
              background: mode === 'live' ? 'var(--success-subtle)' : 'var(--warning-subtle)',
              color: mode === 'live' ? 'var(--success-text)' : 'var(--warning-text)',
              border: `1px solid ${mode === 'live' ? 'var(--success)' : 'var(--warning)'}`,
              padding: '2px 10px',
              borderRadius: 'var(--radius-full)',
              fontSize: '0.75rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {mode === 'live' ? '🟢 Live API Mode' : '🟡 Mock Offline Mode'}
          </button>
        </div>

        <h1 style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
          Discover Product Videos & Ads
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px', fontSize: '1.05rem', lineHeight: 1.5 }}>
          Search cross-platform Instagram Reels and Meta Ad Library campaigns with multimodal visual grounding & deduplication.
        </p>

        {/* Quick Demo Pre-fill Pills */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', alignSelf: 'center' }}>Try Demo:</span>
          <button
            type="button"
            onClick={() => handleQuickDemo('fenty')}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            💄 Fenty Beauty Gloss
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo('represent')}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            👕 Represent 247 Tank
          </button>
          <button
            type="button"
            onClick={() => handleQuickDemo('anker')}
            style={{
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              border: '1px solid var(--border-strong)',
              backgroundColor: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: '0.8125rem',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            🔋 Anker Power Bank
          </button>
        </div>
      </div>

      {/* Main Form Card */}
      <Card padding="lg" style={{ boxShadow: 'var(--shadow-lg)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Input Method Tabs */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Tabs
              tabs={[
                { id: 'product_url', label: 'Product URL', icon: <Link2 size={16} /> },
                { id: 'keyword', label: 'Product Name / Keywords', icon: <Type size={16} /> },
                { id: 'image_upload', label: 'Image Upload', icon: <ImageIcon size={16} /> },
              ]}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as any)}
            />

            {onOpenHistory && (
              <button
                type="button"
                onClick={onOpenHistory}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Clock size={16} /> History
              </button>
            )}
          </div>

          {/* Active Tab Input Area */}
          <div>
            {activeTab === 'product_url' && (
              <Input
                label="Product Webpage URL"
                placeholder="https://brand.com/products/your-item"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                helperText="Paste any direct e-commerce, Shopify, or marketplace product page link."
                leftIcon={<Link2 size={18} />}
                autoFocus
              />
            )}

            {activeTab === 'keyword' && (
              <Input
                label="Product Name, Brand & Keywords"
                placeholder="e.g. Fenty Beauty Gloss Bomb Universal Lip Luminizer"
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                helperText="Enter explicit brand, product name, or style terms."
                leftIcon={<Type size={18} />}
                autoFocus
              />
            )}

            {activeTab === 'image_upload' && (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-strong)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '32px 20px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/png, image/jpeg, image/webp"
                  style={{ display: 'none' }}
                  onChange={handleImageSelect}
                />

                {imagePreview ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                    <img
                      src={imagePreview}
                      alt="Product preview"
                      style={{
                        maxWidth: '160px',
                        maxHeight: '160px',
                        borderRadius: 'var(--radius-md)',
                        objectFit: 'contain',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)' }}>
                      {selectedImage?.name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Click or drag a new image to replace
                    </span>
                  </div>
                ) : (
                  <>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-subtle)',
                        color: 'var(--primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <UploadCloud size={24} />
                    </div>
                    <div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        Click to upload
                      </span>{' '}
                      or drag and drop
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      PNG, JPG or WebP (max 10MB)
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Sources and Threshold Controls */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {/* Source Selection */}
            <div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                Discovery Sources
              </span>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleSourceToggle('instagram')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: sources.includes('instagram') ? '2px solid #E1306C' : '1px solid var(--border-subtle)',
                    backgroundColor: sources.includes('instagram') ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    boxShadow: sources.includes('instagram') ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Instagram size={18} color="#E1306C" />
                  Instagram Reels
                  {sources.includes('instagram') && <CheckCircle2 size={16} color="#E1306C" />}
                </button>

                <button
                  type="button"
                  onClick={() => handleSourceToggle('meta')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px',
                    borderRadius: 'var(--radius-md)',
                    border: sources.includes('meta') ? '2px solid var(--meta-blue)' : '1px solid var(--border-subtle)',
                    backgroundColor: sources.includes('meta') ? 'var(--bg-card)' : 'var(--bg-subtle)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    boxShadow: sources.includes('meta') ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Flame size={18} color="var(--meta-blue)" />
                  Meta Ad Library
                  {sources.includes('meta') && <CheckCircle2 size={16} color="var(--meta-blue)" />}
                </button>
              </div>
            </div>

            {/* Threshold Slider */}
            <div>
              <Slider
                label="Minimum Match Threshold"
                value={minMatchThreshold}
                min={40}
                max={90}
                step={5}
                onChange={setMinMatchThreshold}
                helperText="Filters out videos scoring below rubric threshold (default 60%)"
              />
            </div>
          </div>

          {/* Error Notice */}
          {errorMessage && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--danger-subtle)',
                color: 'var(--danger-text)',
                fontSize: '0.875rem',
                fontWeight: 500,
              }}
            >
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button */}
          <Button
            type="submit"
            size="lg"
            variant="raspberry"
            isLoading={isLoading}
            rightIcon={<ArrowRight size={18} />}
            style={{ width: '100%', marginTop: '6px' }}
          >
            Launch Video Discovery Pipeline
          </Button>
        </form>
      </Card>
    </div>
  );
};
