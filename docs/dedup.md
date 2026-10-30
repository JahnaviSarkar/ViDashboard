# ViDashboard - Deduplication Strategy

## Deduplication Stages
1. **Exact Deduplication**:
   - Platform + Platform Video ID uniqueness constraint (`unique(platform, platform_video_id)`).
   - Canonical URL normalisation and hashing.
2. **Within-Search Near-Duplicate Clustering**:
   - Perceptual image hashing (dHash) on sample frames/thumbnails (Hamming distance $\le 10$).
   - Embedding cosine similarity threshold ($\ge 0.95$).
   - Text token Jaccard similarity on captions/ad copy ($\ge 0.85$).
3. **Cross-Search Seen Video Filtering**:
   - Tracked in `seen_videos` table. Excluded by default unless `showPreviouslySeen=true`.
