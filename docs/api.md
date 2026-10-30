# ViDashboard - API Reference

## Endpoints

### 1. Health Check
- **`GET /api/health`**
- Response:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-10-30T09:45:00.000Z",
    "uptime": 12.34,
    "database": "connected"
  }
  ```

### 2. Search Creation (Phase 2)
- **`POST /api/search`**
- Initiates a discovery run, enqueues pipeline job, returns 202 Accepted.

### 3. Server-Sent Events (SSE) (Phase 1+)
- **`GET /api/search/:id/events`**
- Real-time pipeline events with `Last-Event-ID` support.

### 4. Search Results & Status (Phase 2+)
- **`GET /api/search/:id`**
- Returns search state, product metadata, and ranked video results.

### 5. Search History (Phase 2+)
- **`GET /api/history`**
- List of previous searches with result counts and timestamps.
