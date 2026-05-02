const { parseJsonText } = require("../utils/json");

class EvaluationApiClient {
  constructor({ baseUrl, requestTimeoutMs, authClient }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.requestTimeoutMs = requestTimeoutMs;
    this.authClient = authClient;
  }

  async getProtectedJson(path) {
    const token = await this.authClient.getAccessToken();
    const endpoint = `${this.baseUrl}${path}`;

    const controller = new AbortController();
    const timeoutRef = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`
        },
        signal: controller.signal
      });

      const text = await response.text();
      const body = parseJsonText(text);

      if (!response.ok) {
        throw new Error(`GET ${path} failed with status ${response.status}`);
      }

      return body;
    } finally {
      clearTimeout(timeoutRef);
    }
  }

  async getNotifications() {
    const body = await this.getProtectedJson("/notifications");
    return Array.isArray(body.notifications) ? body.notifications : [];
  }
}

module.exports = { EvaluationApiClient };

