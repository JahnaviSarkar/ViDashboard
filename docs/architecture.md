# ViDashboard - Architecture

## System Overview
ViDashboard is a high-performance Product Video Discovery Dashboard built with Node.js Fastify backend and React Vite frontend.

```mermaid
graph TD
    User([User]) -->|Product URL / Keyword / Image| Frontend[React SPA Vite]
    Frontend -->|POST /api/search| Backend[Fastify API Server]
    Frontend -->|SSE /api/search/:id/events| Backend
    Backend -->|Enqueue Job| Queue[pg-boss Job Queue]
    Queue -->|Execute Pipeline| Orchestrator[Pipeline Orchestrator]
    Orchestrator --> Resolver[Product URL Resolver]
    Orchestrator --> Brain[Image Brain / Vision Model]
    Orchestrator --> InstagramCollector[Instagram Reels Collector]
    Orchestrator --> MetaCollector[Meta Ad Library Collector]
    Orchestrator --> Scorer[Visual & Rubric Scoring Engine]
    Orchestrator --> Dedup[Deduplication & Clustering Service]
    Orchestrator --> DB[(PostgreSQL Database)]
```

## Key Architectural Principles
1. **Isolated Parallel Execution**: Instagram and Meta collectors run independently in parallel via `Promise.allSettled`.
2. **Resilient SSE Replay**: Pipeline stages stream over Server-Sent Events with persistent `pipeline_events` replay using `Last-Event-ID`.
3. **Multi-tiered Scoring & Dedup**: Exact hashing, dHash perceptual hashing, caption similarity, and CLIP/VLM rubric judging.
4. **Honest Accounting**: Transparent shortfall reporting if platform limits or availability fall below target.
