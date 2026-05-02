const { parseJsonText } = require("../utils/json");

class AuthClient {
  constructor({ baseUrl, authPayload, requestTimeoutMs, log }) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.authPayload = authPayload;
    this.requestTimeoutMs = requestTimeoutMs;
    this.log = log;
    this.cachedToken = "";
    this.expiresAt = 0;
  }

  hasValidToken() {
    return this.cachedToken && Date.now() < this.expiresAt - 10_000;
  }

  async getAccessToken() {
    if (this.hasValidToken()) {
      return this.cachedToken;
    }

    const endpoint = `${this.baseUrl}/auth`;
    const controller = new AbortController();
    const timeoutRef = setTimeout(() => controller.abort(), this.requestTimeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.authPayload),
        signal: controller.signal
      });

      const text = await response.text();
      const body = parseJsonText(text);

      if (!response.ok) {
        throw new Error(`Auth failed with status ${response.status}`);
      }

      const accessToken = body.access_token;
      if (!accessToken) {
        throw new Error("Auth response does not contain access_token");
      }

      const expiresInSeconds = Number(body.expires_in || 300);
      this.cachedToken = accessToken;
      this.expiresAt = Date.now() + expiresInSeconds * 1000;

      return this.cachedToken;
    } finally {
      clearTimeout(timeoutRef);
    }
  }
}

module.exports = { AuthClient };

