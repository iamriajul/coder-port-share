#!/usr/bin/env node

const https = require("https");
const http = require("http");

const [workspace, port, level = "public"] = process.argv.slice(2);

if (!workspace || !port) {
  console.error("Usage: coder-port-share <workspace> <port> [level]");
  console.error("  level: public (default) | authenticated | owner");
  process.exit(1);
}

const { CODER_URL, CODER_SESSION_TOKEN } = process.env;

if (!CODER_URL) { console.error("Error: CODER_URL is not set"); process.exit(1); }
if (!CODER_SESSION_TOKEN) { console.error("Error: CODER_SESSION_TOKEN is not set"); process.exit(1); }

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(JSON.parse(data)));
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

const headers = {
  "Coder-Session-Token": CODER_SESSION_TOKEN,
  "Content-Type": "application/json",
};

async function main() {
  const [workspacesRes, meRes] = await Promise.all([
    request(`${CODER_URL}/api/v2/workspaces?name=${workspace}`, { headers }),
    request(`${CODER_URL}/api/v2/users/me`, { headers }),
  ]);

  const workspaceId = workspacesRes.workspaces[0].id;
  const username = meRes.username;

  const body = JSON.stringify({ agent_name: "main", port: Number(port), share_level: level, protocol: "http" });

  await request(`${CODER_URL}/api/v2/workspaces/${workspaceId}/port-share`, {
    method: "POST",
    headers,
    body,
  });

  const domain = CODER_URL.replace(/^https?:\/\//, "").replace(/\/$/, "");
  console.log(`https://${port}--main--${workspace}--${username}.${domain}/`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
