const http = require("node:http");
const { URL } = require("node:url");
const config = require("./config");
const { createLogger } = require("../../logging_middleware/src");
const { AuthClient } = require("./clients/authClient");
const { EvaluationApiClient } = require("./clients/evaluationApiClient");
const { buildDepotSchedules, chooseTasksWithinHours } = require("./services/schedulerService");
const { sendJson, readJsonBody } = require("./utils/http");

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

async function handleHealth(req, res) {
  sendJson(res, 200, {
    ok: true,
    service: "vehicle-maintenance-scheduler"
  });
}

async function handleScheduleForAllDepots(req, res) {
  await logger.Log("backend", "info", "controller", "schedule request received for all depots");

  const [depots, vehicles] = await Promise.all([
    evaluationApi.getDepots(),
    evaluationApi.getVehicles()
  ]);

  const schedules = buildDepotSchedules(depots, vehicles);

  await logger.Log("backend", "info", "service", `computed schedules for ${schedules.length} depots`);

  sendJson(res, 200, {
    generatedAt: new Date().toISOString(),
    depotsCount: depots.length,
    vehiclesCount: vehicles.length,
    schedules
  });
}

async function handleScheduleForOneDepot(req, res, url) {
  const depotId = Number(url.searchParams.get("depotId"));
  if (!Number.isFinite(depotId)) {
    sendJson(res, 400, { error: "depotId query param is required and must be a number" });
    return;
  }

  const [depots, vehicles] = await Promise.all([
    evaluationApi.getDepots(),
    evaluationApi.getVehicles()
  ]);

  const depot = depots.find((item) => Number(item.ID) === depotId);
  if (!depot) {
    sendJson(res, 404, { error: `depotId ${depotId} not found` });
    return;
  }

  const schedule = chooseTasksWithinHours(vehicles, Number(depot.MechanicHours || 0));

  await logger.Log("backend", "debug", "service", `computed schedule for depot ${depotId}`);

  sendJson(res, 200, {
    generatedAt: new Date().toISOString(),
    depot: {
      id: Number(depot.ID),
      mechanicHours: Number(depot.MechanicHours || 0)
    },
    schedule
  });
}

async function handleManualSchedule(req, res) {
  const payload = await readJsonBody(req);
  const mechanicHours = Number(payload.mechanicHours);
  const vehicles = Array.isArray(payload.vehicles) ? payload.vehicles : [];

  if (!Number.isFinite(mechanicHours) || mechanicHours < 0) {
    sendJson(res, 400, { error: "mechanicHours must be a non-negative number" });
    return;
  }

  const schedule = chooseTasksWithinHours(vehicles, mechanicHours);
  await logger.Log("backend", "info", "service", "computed manual schedule from request body");

  sendJson(res, 200, {
    generatedAt: new Date().toISOString(),
    schedule
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

    if (method === "GET" && url.pathname === "/api/schedule") {
      if (url.searchParams.has("depotId")) {
        await handleScheduleForOneDepot(req, res, url);
      } else {
        await handleScheduleForAllDepots(req, res);
      }
      return;
    }

    if (method === "POST" && url.pathname === "/api/schedule") {
      await handleManualSchedule(req, res);
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
  console.log(`Vehicle scheduler listening on http://localhost:${config.port}`);
});

