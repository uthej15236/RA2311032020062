const { parseJsonText } = require("./json");

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload, null, 2));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
      }
    });

    req.on("end", () => resolve(parseJsonText(body)));
    req.on("error", reject);
  });
}

module.exports = {
  sendJson,
  readJsonBody
};

