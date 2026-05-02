# Logging Middleware

Reusable logger utility built around the required function shape:

`Log(stack, level, package, message)`

It validates input values and calls the test server log API.

## Usage

```js
const { createLogger } = require("./src");

const logger = createLogger({
  baseUrl: "http://20.207.122.201/evaluation-service",
  getAccessToken: async () => "<bearer-token>"
});

await logger.Log("backend", "info", "service", "vehicle schedule created");
```

## Allowed fields

- stack: `backend`, `frontend`
- level: `debug`, `info`, `warn`, `error`, `fatal`
- package:
  - Backend-only: `cache`, `controller`, `cron_job`, `db`, `domain`, `handler`, `repository`, `route`, `service`
  - Frontend-only: `api`, `component`, `hook`, `page`, `state`, `style`
  - Common: `auth`, `config`, `middleware`, `utils`

