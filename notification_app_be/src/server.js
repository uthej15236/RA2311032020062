const http = require("node:http");
const { URL } = require("node:url");
const config = require("./config");
const { createLogger } = require("../../logging_middleware/src");
const { AuthClient } = require("./clients/authClient");
const { EvaluationApiClient } = require("./clients/evaluationApiClient");
const { sendJson } = require("./utils/http");
const { selectTopPriorityNotifications, PriorityInboxStore } = require("./services/priorityService");

const authClient = new AuthClient({
  baseUrl: config.baseUrl,
  authPayload: config.authPayload,
  requestTimeoutMs: config.requestTimeoutMs
});

const logger = createLogger({
  baseUrl: config.baseUrl,
  getAccessToken: () => authClient.getAccessToken(),
  timeoutMs: config.requestTimeoutMs
});

const evaluationApi = new EvaluationApiClient({
  baseUrl: config.baseUrl,
  requestTimeoutMs: config.requestTimeoutMs,
  authClient
});

const inboxStore = new PriorityInboxStore(10);

async function handleHealth(req, res) {
  sendJson(res, 200, {
    ok: true,
    service: "notification-app-be"
  });
}

async function handlePriorityNotifications(req, res, url) {
  const top = Number(url.searchParams.get("top") || 10);
  const topN = Number.isFinite(top) && top > 0 ? Math.min(top, 50) : 10;

  await logger.Log("backend", "info", "controller", "priority notifications request received");

  const notifications = await evaluationApi.getNotifications();
  const prioritized = selectTopPriorityNotifications(notifications, topN);

  await logger.Log(
    "backend",
    "debug",
    "service",
    `computed top ${prioritized.length} notifications out of ${notifications.length}`
  );

  sendJson(res, 200, {
    generatedAt: new Date().toISOString(),
    totalFetched: notifications.length,
    topN,
    items: prioritized
  });
}

async function handleRefreshCache(req, res) {
  const notifications = await evaluationApi.getNotifications();
  inboxStore.addNotifications(notifications);

  await logger.Log("backend", "info", "cache", `cache refreshed with ${notifications.length} notifications`);

  sendJson(res, 200, {
    generatedAt: new Date().toISOString(),
    cachedCount: inboxStore.getSnapshot().length
  });
}

async function handleCachedPriority(req, res) {
  sendJson(res, 200, {
    generatedAt: new Date().toISOString(),
    items: inboxStore.getSnapshot()
  });
}

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  try {
    if (method === "GET" && url.pathname === "/health") {
      await handleHealth(req, res);
      return;
    }

    if (method === "GET" && url.pathname === "/api/priority-notifications") {
      await handlePriorityNotifications(req, res, url);
      return;
    }

    if (method === "POST" && url.pathname === "/api/priority-notifications/refresh") {
      await handleRefreshCache(req, res);
      return;
    }

    if (method === "GET" && url.pathname === "/api/priority-notifications/cached") {
      await handleCachedPriority(req, res);
      return;
    }

    sendJson(res, 404, { error: "Route not found" });
  } catch (error) {
    await logger.Log("backend", "error", "handler", `request failed: ${error.message}`);
    sendJson(res, 500, {
      error: "Internal server error",
      message: error.message
    });
  }
});

server.listen(config.port, () => {
  console.log(`Notification app listening on http://localhost:${config.port}`);
});

