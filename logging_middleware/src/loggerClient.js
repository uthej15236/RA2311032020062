const ALLOWED_STACKS = new Set(["backend", "frontend"]);
const ALLOWED_LEVELS = new Set(["debug", "info", "warn", "error", "fatal"]);
const ALLOWED_PACKAGES = new Set([
  "cache",
  "controller",
  "cron_job",
  "db",
  "domain",
  "handler",
  "repository",
  "route",
  "service",
  "api",
  "component",
  "hook",
  "page",
  "state",
  "style",
  "auth",
  "config",
  "middleware",
  "utils"
]);

class LoggerClient {
  constructor(options = {}) {
    const {
      baseUrl = "http://20.207.122.201/evaluation-service",
      getAccessToken = async () => "",
      timeoutMs = 7000
    } = options;

    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.getAccessToken = getAccessToken;
    this.timeoutMs = timeoutMs;
  }

  validate(stack, level, pkg, message) {
    if (!ALLOWED_STACKS.has(stack)) {
      throw new Error(`Invalid stack "${stack}"`);
    }

    if (!ALLOWED_LEVELS.has(level)) {
      throw new Error(`Invalid level "${level}"`);
    }

    if (!ALLOWED_PACKAGES.has(pkg)) {
      throw new Error(`Invalid package "${pkg}"`);
    }

    if (typeof message !== "string" || message.trim().length === 0) {
      throw new Error("message must be a non-empty string");
    }
  }

  async log(stack, level, pkg, message) {
    this.validate(stack, level, pkg, message);

    const token = await this.getAccessToken();
    const payload = { stack, level, package: pkg, message };
    const endpoint = `${this.baseUrl}/logs`;

    const controller = new AbortController();
    const timeoutRef = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const text = await response.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (error) {
          data = { raw: text };
        }
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          error: data
        };
      }

      return {
        ok: true,
        status: response.status,
        data
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error.message
      };
    } finally {
      clearTimeout(timeoutRef);
    }
  }
}

module.exports = {
  LoggerClient,
  ALLOWED_STACKS,
  ALLOWED_LEVELS,
  ALLOWED_PACKAGES
};

