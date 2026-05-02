# Notification System Design

## Stage 1

### 1. Core Actions to Support

1. List notifications for the logged-in student.
2. Mark one notification as read.
3. Mark all notifications as read.
4. Get unread count for badge rendering.
5. Publish notification events (internal producer API).
6. Receive real-time updates while user is online.

### 2. REST API Contract

#### `GET /v1/notifications`

Query params:

- `cursor` (opaque string, optional)
- `limit` (default 20, max 100)
- `type` (`Placement | Result | Event`, optional)
- `isRead` (`true | false`, optional)

Response:

```json
{
  "items": [
    {
      "id": "d146095a-ed86-4a34-9e69-3900a14576bc",
      "studentId": 1042,
      "type": "Result",
      "message": "mid-sem",
      "isRead": false,
      "createdAt": "2026-04-22T17:51:30Z"
    }
  ],
  "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTA0LTIyVDE3OjUxOjMwWiIsImlkIjoiZDE0NjA5NWEtZWQ4Ni00YTM0LTllNjktMzkwMGExNDU3NmJjIn0="
}
```

#### `PATCH /v1/notifications/:id/read`

Request:

```json
{
  "isRead": true
}
```

Response:

```json
{
  "id": "d146095a-ed86-4a34-9e69-3900a14576bc",
  "isRead": true,
  "updatedAt": "2026-04-22T18:02:15Z"
}
```

#### `PATCH /v1/notifications/read-all`

Response:

```json
{
  "updatedCount": 135
}
```

#### `GET /v1/notifications/unread-count`

Response:

```json
{
  "unreadCount": 18
}
```

#### `POST /v1/notifications` (internal producer route)

Request:

```json
{
  "studentId": 1042,
  "type": "Placement",
  "message": "CSX Corporation hiring",
  "metadata": {
    "company": "CSX Corporation",
    "eventId": "plc-2026-04-22-7788"
  }
}
```

Response:

```json
{
  "id": "2b23128f-ea3a-4b7c-93a9-1f2f24edb40e",
  "createdAt": "2026-04-22T17:51:18Z"
}
```

### 3. Required Headers

Request headers:

- `Authorization: Bearer <token>`
- `Content-Type: application/json`
- `X-Request-ID: <uuid>` (for traceability)

Response headers:

- `X-Request-ID: <uuid>`
- `Cache-Control: no-store` for personalized payloads

### 4. JSON Schema (essential)

Notification object:

```json
{
  "id": "uuid",
  "studentId": "number",
  "type": "Placement | Result | Event",
  "message": "string (1..280)",
  "isRead": "boolean",
  "createdAt": "ISO-8601 string",
  "updatedAt": "ISO-8601 string"
}
```

### 5. Real-time mechanism

Use **Server-Sent Events** endpoint:

- `GET /v1/notifications/stream`
- Keep one persistent connection per active user session.
- Send event payloads like:

```json
{
  "event": "notification.created",
  "data": {
    "id": "2b23128f-ea3a-4b7c-93a9-1f2f24edb40e",
    "type": "Placement",
    "message": "CSX Corporation hiring",
    "createdAt": "2026-04-22T17:51:18Z"
  }
}
```

Reason: SSE is enough for one-way server push and simpler than WebSocket for this use case.

## Stage 2

### DB choice

Use **PostgreSQL** for transactional consistency and predictable querying.

Proposed table:

- `notifications(id, student_id, type, message, is_read, created_at, updated_at)`

As volume grows, use:

1. Monthly partitioning on `created_at`.
2. Read replicas for fan-out reads.
3. Redis cache for unread count and latest page.

### Risks when volume increases

1. Large-table scans for unread inbox and sort-by-time.
2. High write rate for bulk notifications.
3. Lock contention if many updates are done without batching.
4. Increased latency if every screen requests full inbox.

### Solutions

1. Cursor pagination instead of offset pagination.
2. Composite and partial indexes for read-heavy paths.
3. Batch updates for mark-all-read.
4. Event-driven write path (queue + worker) for bulk fan-out.
5. Retention/archival strategy for old notifications.

### Why not NoSQL first?

NoSQL can scale well, but for this product a lot of filtering and user-action consistency (read/unread correctness) is easier and safer to implement first in PostgreSQL.

## Stage 3

Given query:

```sql
SELECT * FROM notifications
WHERE studentID = 1042 AND isRead = false
ORDER BY createdAt DESC;
```

### Issues

1. `SELECT *` reads more columns than needed.
2. Without composite index, DB will sort large candidate set.
3. Growth to millions of rows makes this expensive.

### Better query

```sql
SELECT id, notificationType, message, createdAt
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt DESC
LIMIT 20;
```

### Index strategy

Use a targeted index, not "index every column":

```sql
CREATE INDEX idx_notifications_student_unread_created
ON notifications (studentID, isRead, createdAt DESC);
```

For PostgreSQL, partial index is even better:

```sql
CREATE INDEX idx_notifications_student_unread_partial
ON notifications (studentID, createdAt DESC)
WHERE isRead = false;
```

Why not index every column:

1. Slower inserts/updates (each extra index must be maintained).
2. More disk usage and cache pressure.
3. Planner may still not use many low-selectivity indexes.

### Find placement notifications in last 7 days

```sql
SELECT id, studentID, message, createdAt
FROM notifications
WHERE notificationType = 'Placement'
  AND createdAt >= NOW() - INTERVAL '7 days'
ORDER BY createdAt DESC;
```

Supporting index:

```sql
CREATE INDEX idx_notifications_type_created
ON notifications (notificationType, createdAt DESC);
```

Likely cost after indexing: index range scan on `notificationType='Placement'` then bounded time scan for the 7-day window, much lower than full scan.

## Stage 4

Problem: notifications are fetched on every page load for every student.

### Strategy A: lazy load + dedicated notifications call

Only fetch inbox when user opens notifications drawer/page.

Tradeoff:

- Pros: large drop in unnecessary reads.
- Cons: notifications are not preloaded.

### Strategy B: unread count cache

Store `unread_count:{studentId}` in Redis; update asynchronously on create/read actions.

Tradeoff:

- Pros: very fast badge rendering.
- Cons: eventual consistency for short windows.

### Strategy C: cursor pagination

Fetch latest 20 only; load more on demand.

Tradeoff:

- Pros: bounded query cost.
- Cons: client logic is slightly more complex.

### Strategy D: real-time push channel

Push only new notifications by SSE/WebSocket.

Tradeoff:

- Pros: fewer polling calls, better UX.
- Cons: requires connection lifecycle handling.

### Strategy E: edge/cache policy

Cache non-personal metadata (templates, type configs), never personalized inbox pages.

Tradeoff:

- Pros: reduces infra load around static metadata.
- Cons: does not directly reduce user-inbox query volume.

Recommended combination: A + B + C + D.

## Stage 5

Given pseudo-code:

```ts
function notify_all(student_ids: array, message: string):
    for student_id in student_ids:
        send_email(student_id, message)
        save_to_db(student_id, message)
        push_to_app(student_id, message)
```

### Shortcomings

1. One long loop; no throughput control.
2. No retries or backoff for transient failures.
3. No idempotency protection (duplicate sends possible).
4. No transactional boundary between DB write and external side effects.
5. Partial failures leave inconsistent state.
6. If email for one student fails midway, process state is unclear.

### If 200 emails failed midway

Never re-run the entire loop blindly. Use persisted delivery states and retry only failed jobs with idempotency keys.

### Should DB save and email happen together?

Not in one distributed transaction. Use **Outbox Pattern**:

1. In one local DB transaction, insert notification row + outbox events.
2. A worker reads outbox rows and triggers email/push.
3. Mark outbox status (`pending/sent/failed/retry_scheduled`).

This gives atomic intent recording and reliable eventual delivery.

### Revised pseudo-code

```ts
function queue_notify_all(studentIds: string[], message: string, campaignId: string) {
  for (const studentId of studentIds) {
    begin_transaction();

    const notificationId = insert_notification({
      studentId,
      message,
      campaignId
    });

    insert_outbox({
      eventType: "notification.created",
      notificationId,
      studentId,
      channel: "email",
      idempotencyKey: `${campaignId}:${studentId}:email`,
      status: "pending"
    });

    insert_outbox({
      eventType: "notification.created",
      notificationId,
      studentId,
      channel: "app_push",
      idempotencyKey: `${campaignId}:${studentId}:push`,
      status: "pending"
    });

    commit_transaction();
  }
}

function worker_process_outbox(batchSize: number) {
  const jobs = lock_pending_jobs(batchSize);

  for (const job of jobs) {
    try {
      if (already_processed(job.idempotencyKey)) {
        mark_sent(job.id);
        continue;
      }

      if (job.channel === "email") {
        send_email(job.studentId, job.payload.message);
      } else {
        push_to_app(job.studentId, job.payload.message);
      }

      mark_sent(job.id);
    } catch (error) {
      const retryCount = increment_retry(job.id);
      if (retryCount >= 5) {
        mark_failed(job.id, error.message);
      } else {
        schedule_retry(job.id, exponential_backoff(retryCount));
      }
    }
  }
}
```

