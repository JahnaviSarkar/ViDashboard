import React, { useRef, useState } from 'react';
import { Search as SearchIcon, Image as ImageIcon, Sparkles, X, Link as LinkIcon } from 'lucide-react';
import { Button } from '../../design-system';

export interface TopSearchBarProps {
  onSearch: (input: { text: string; image?: File }) => void;
  isLoading?: boolean;
}

export const TopSearchBar: React.FC<TopSearchBarProps> = ({ onSearch, isLoading = false }) => {
  const [inputText, setInputText] = useState('');
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedImage(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setAttachedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() && !attachedImage) return;
    onSearch({ text: inputText.trim(), image: attachedImage || undefined });
  };

  const handleDemoClick = (url: string) => {
    setInputText(url);
    onSearch({ text: url });
  };

  return (
    <div style={{ width: '100%', maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          borderRadius: 'var(--radius-pill)',
          padding: '6px 8px 6px 20px',
          border: '1.5px solid #E9E3ED',
          boxShadow: '0 4px 20px rgba(147, 171, 217, 0.15)',
          gap: '10px',
          transition: 'all 0.2s ease',
        }}
      >
        <SearchIcon size={20} color="#77717F" style={{ flexShrink: 0 }} />

        {/* Text Input for URL or Keyword */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste product URL (Shopify/Brand) or enter keywords..."
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            fontSize: '0.9375rem',
            color: '#292633',
            fontFamily: 'var(--font-sans)',
            background: 'transparent',
            minWidth: 0,
          }}
        />

        {/* Attached Image Thumbnail Pill (if image is attached) */}
        {imagePreview && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '2px 8px 2px 4px',
              borderRadius: 'var(--radius-pill)',
              backgroundColor: '#FDE8F1',
              border: '1px solid #F9A8CE',
            }}
          >
            <img
              src={imagePreview}
              alt="Attached preview"
              style={{ width: '22px', height: '22px', borderRadius: '50%', objectFit: 'cover' }}
            />
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#B82869', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {attachedImage?.name}
            </span>
            <button
              type="button"
              onClick={handleRemoveImage}
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#B82869',
                display: 'flex',
                padding: '2px',
              }}
            >
              <X size={12} />
            </button>
          </div>
        )}

        {/* Image Upload Button NEXT TO search input */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleImageChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: '#F5F2F7',
            border: '1px solid #E9E3ED',
            borderRadius: 'var(--radius-pill)',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#292633',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'background 0.15s ease',
          }}
          title="Attach product image"
        >
          <ImageIcon size={16} color="#93ABD9" />
          <span>Upload Image</span>
        </button>

        {/* Raspberry "Run Image Brain" Action Button */}
        <Button
          type="submit"
          variant="raspberry"
          size="md"
          isLoading={isLoading}
          rightIcon={<Sparkles size={16} />}
          style={{ flexShrink: 0 }}
        >
          Run Image Brain
        </Button>
      </form>

      {/* Verified Demo Pills (Anker removed) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#77717F' }}>Verified Demos:</span>

        <button
          type="button"
          onClick={() => handleDemoClick('https://fentybeauty.com/products/gloss-bomb-universal-lip-luminizer-fenty-glow')}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid #E9E3ED',
            backgroundColor: '#FFFFFF',
            color: '#292633',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 1px 4px rgba(147, 171, 217, 0.08)',
          }}
        >
          <span>💄 Fenty Beauty Gloss</span>
          <LinkIcon size={11} color="#93ABD9" />
        </button>

        <button
          type="button"
          onClick={() => handleDemoClick('https://representclo.com/products/247-oversized-tank-black')}
          style={{
            padding: '4px 12px',
            borderRadius: 'var(--radius-pill)',
            border: '1px solid #E9E3ED',
            backgroundColor: '#FFFFFF',
            color: '#292633',
            fontSize: '0.75rem',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            boxShadow: '0 1px 4px rgba(147, 171, 217, 0.08)',
          }}
        >
          <span>👕 Represent 247 Tank</span>
          <LinkIcon size={11} color="#93ABD9" />
        </button>
      </div>
    </div>
  );
};

