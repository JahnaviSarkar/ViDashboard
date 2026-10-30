# ViDashboard - Scoring Engine Reference

## Hybrid Scoring Methodology (Phase 4)
Each candidate video is evaluated against the resolved product image using a weighted hybrid model:

$$Score = (w_{embed} \times S_{embed}) + (w_{rubric} \times S_{rubric}) + B_{logo} - P_{novis}$$

### Default Weights
- Embedding similarity ($w_{embed}$): 0.40
- VLM Rubric judgment ($w_{rubric}$): 0.60
- Configurable `MIN_MATCH_THRESHOLD`: 60 (0-100)
