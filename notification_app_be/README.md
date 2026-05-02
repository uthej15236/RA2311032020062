# Notification App Backend (Stage 6)

This service solves Stage 6 from the prompt:

- Fetch notifications from protected API.
- Prioritize unread notifications using:
  - type weight (`Placement > Result > Event`)
  - recency (`Timestamp` as tie-break within weight)
- Return top 10 (or custom top N) notifications.

## Why this approach

- Uses a min-heap of size `k` to keep only top `k` while scanning data.
- Time complexity: `O(n log k)` with `k = 10`.
- Space complexity: `O(k)` for top set.
- Supports incremental updates via in-memory `PriorityInboxStore`.

## Run

```bash
cp .env.example .env
node src/server.js
```

## Local API

### 1) Health

`GET /health`

### 2) Fresh top priority list

`GET /api/priority-notifications?top=10`

### 3) Refresh in-memory top-10 cache

`POST /api/priority-notifications/refresh`

### 4) Read in-memory top-10 cache

`GET /api/priority-notifications/cached`

