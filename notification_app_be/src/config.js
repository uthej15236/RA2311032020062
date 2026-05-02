const path = require("node:path");
const { loadEnvFile } = require("node:process");

function loadLocalEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  try {
    loadEnvFile(envPath);
  } catch (error) {
    // .env is optional if vars are injected from shell or CI.
  }
}

function numberOrDefault(value, defaultValue) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

loadLocalEnv();

module.exports = {
  port: numberOrDefault(process.env.PORT, 3002),
  requestTimeoutMs: numberOrDefault(process.env.REQUEST_TIMEOUT_MS, 7000),
  baseUrl: process.env.EVAL_BASE_URL || "http://20.207.122.201/evaluation-service",
  authPayload: {
    email: process.env.AUTH_EMAIL || "",
    name: process.env.AUTH_NAME || "",
    rollNo: process.env.AUTH_ROLL_NO || "",
    accessCode: process.env.AUTH_ACCESS_CODE || "",
    clientID: process.env.AUTH_CLIENT_ID || "",
    clientSecret: process.env.AUTH_CLIENT_SECRET || ""
  }
};
