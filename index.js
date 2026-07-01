#!/usr/bin/env node

const https = require("https");
const http = require("http");

const SHARE_LEVELS = new Set(["public", "authenticated", "owner"]);

function usage() {
  console.error("Usage: coder-port-share [workspace] <port> [level]");
  console.error("  workspace: defaults to CODER_WORKSPACE_NAME when omitted");
  console.error("  level: public (default) | authenticated | owner");
}

function parseArgs(args, env) {
  const [first, second, third, ...extra] = args;
  if (!first || extra.length > 0) {
    return { error: "invalid arguments" };
  }

  if (second && !SHARE_LEVELS.has(second)) {
    return {
      workspace: first,
      port: second,
      level: third || "public",
    };
  }

  return {
    workspace: env.CODER_WORKSPACE_NAME,
    port: first,
    level: second || "public",
  };
}

function required(name, value, fallbackName) {
  if (value) return value;
  const suffix = fallbackName ? ` (or ${fallbackName})` : "";
  throw new Error(`${name}${suffix} is not set`);
}

function normalizeBaseUrl(rawUrl) {
  const url = new URL(rawUrl);
  return url.toString().replace(/\/$/, "");
}

function appDomain(baseUrl) {
  return new URL(baseUrl).host;
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.request(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        let parsed = {};
        try {
          parsed = data ? JSON.parse(data) : {};
        } catch (err) {
          reject(new Error(`Invalid JSON response from ${url}: ${err.message}`));
          return;
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(parsed.message || `Request failed with status ${res.statusCode}`));
          return;
        }

        resolve(parsed);
      });
    });
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function resolveWorkspaceId({ baseUrl, headers, workspace, workspaceId }) {
  if (workspaceId) return workspaceId;

  const workspacesRes = await request(
    `${baseUrl}/api/v2/workspaces?name=${encodeURIComponent(workspace)}`,
    { headers },
  );
  const found = workspacesRes.workspaces && workspacesRes.workspaces[0];
  if (!found || !found.id) {
    throw new Error(`Workspace not found: ${workspace}`);
  }
  return found.id;
}

async function resolveOwnerName({ baseUrl, headers, ownerName }) {
  if (ownerName) return ownerName;

  const meRes = await request(`${baseUrl}/api/v2/users/me`, { headers });
  if (!meRes.username) {
    throw new Error("Could not resolve Coder username");
  }
  return meRes.username;
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2), process.env);
  if (parsed.error || !parsed.workspace || !parsed.port) {
    usage();
    process.exit(1);
  }

  if (!SHARE_LEVELS.has(parsed.level)) {
    throw new Error(`Invalid share level: ${parsed.level}`);
  }

  const port = Number(parsed.port);
  if (!Number.isInteger(port) || port < 9 || port > 65535) {
    throw new Error("Port must be an integer between 9 and 65535");
  }

  const baseUrl = normalizeBaseUrl(
    required("CODER_AGENT_URL", process.env.CODER_AGENT_URL || process.env.CODER_URL, "CODER_URL"),
  );
  const token = required(
    "CODER_AGENT_TOKEN",
    process.env.CODER_AGENT_TOKEN || process.env.CODER_SESSION_TOKEN,
    "CODER_SESSION_TOKEN",
  );
  const agentName = process.env.CODER_WORKSPACE_AGENT_NAME || "main";

  const headers = {
    "Coder-Session-Token": token,
    "Content-Type": "application/json",
  };

  const [workspaceId, ownerName] = await Promise.all([
    resolveWorkspaceId({
      baseUrl,
      headers,
      workspace: parsed.workspace,
      workspaceId: process.env.CODER_WORKSPACE_ID,
    }),
    resolveOwnerName({
      baseUrl,
      headers,
      ownerName: process.env.CODER_WORKSPACE_OWNER_NAME,
    }),
  ]);

  const body = JSON.stringify({
    agent_name: agentName,
    port,
    share_level: parsed.level,
    protocol: "http",
  });

  await request(`${baseUrl}/api/v2/workspaces/${workspaceId}/port-share`, {
    method: "POST",
    headers,
    body,
  });

  console.log(`https://${port}--${agentName}--${parsed.workspace}--${ownerName}.${appDomain(baseUrl)}/`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
