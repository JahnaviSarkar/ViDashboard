# ViDashboard - Product Video Discovery Dashboard

ViDashboard is a full-stack discovery application that identifies, analyzes, collects, scores, and deduplicates relevant video content (Instagram Reels and Meta Ad Library video ads) matching a target product name, URL, or image.

## Technology Stack
- **Backend:** Node.js 20+ with **Fastify** and TypeScript. Fastify provides schema-based validation, high throughput, and first-class native SSE streaming.
- **Frontend:** **React 18** with **Vite** and TypeScript. Fast SPA startup and development cycle.
- **Database:** **PostgreSQL** with **Drizzle ORM** type-safe schema and migration management.
- **Job Queue:** **pg-boss** for queue processing directly in Postgres without extra Redis overhead.
- **Realtime:** Server-Sent Events (**SSE**) with `Last-Event-ID` replay from `pipeline_events`.
- **Validation:** **Zod** schema validation for environment variables and API contracts.
- **Logging:** Structured JSON logging via **Pino** with correlated request IDs.
- **Testing:** **Vitest** test runner for unit, integration, and repository verification.

## Getting Started

### Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- Docker & Docker Compose (or local PostgreSQL)

### 1. Environment Setup
```bash
cp .env.example .env
```

### 2. Start PostgreSQL
```bash
docker compose up -d postgres
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run Database Migrations
```bash
npm run db:migrate
```

### 5. Start Development Servers
```bash
npm run dev
```
- Backend API: http://localhost:3001
- Frontend App: http://localhost:5173
- Health Check: http://localhost:3001/api/health
