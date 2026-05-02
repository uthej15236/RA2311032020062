# Vehicle Maintenance Scheduler Microservice

This service solves the optimization task from the backend prompt:

- Fetch depots from protected API.
- Fetch vehicles/tasks from protected API.
- For each depot, choose task subset that maximizes total impact under the depot mechanic-hour limit.

## Algorithm

The selection uses classic **0/1 Knapsack dynamic programming**:

- `duration` => weight
- `impact` => value
- `mechanicHours` => capacity

Time complexity: `O(n * W)`  
Space complexity: `O(n * W)` for reconstruction matrix

## Run

```bash
cp .env.example .env
node src/server.js
```

## Local API

### 1) Health

`GET /health`

### 2) Schedule from live test server data

`GET /api/schedule`

### 3) Schedule for one depot

`GET /api/schedule?depotId=2`

### 4) Schedule from manual payload

`POST /api/schedule`

```json
{
  "mechanicHours": 8,
  "vehicles": [
    { "TaskID": "t1", "Duration": 5, "Impact": 8 },
    { "TaskID": "t2", "Duration": 3, "Impact": 6 },
    { "TaskID": "t3", "Duration": 4, "Impact": 7 }
  ]
}
```

