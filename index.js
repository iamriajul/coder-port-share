#!/usr/bin/env node

const https = require("https");
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const SHARE_LEVELS = new Set(["public", "authenticated", "owner"]);

function usage() {
  console.error("Usage: coder-port-share <port> [level] [workspace]");
  console.error("  workspace: optional name for the app URL, defaults to CODER_WORKSPACE_NAME");
  console.error("  level: public (default) | authenticated | owner");
}

function parseArgs(args, env) {
  const [port, level = "public", workspace = env.CODER_WORKSPACE_NAME, ...extra] = args;
  if (!port || extra.length > 0) {
    return { error: "invalid arguments" };
  }

  return {
    workspace,
    port,
    level,
  };
}

function required(name, value, fallbackName) {
  if (value) return value;
  const suffix = fallbackName ? ` (or ${fallbackName})` : "";
  throw new Error(`${name}${suffix} is not set`);
}

function readFileIfPresent(filePath) {
  try {
    const value = fs.readFileSync(filePath, "utf8").trim();
    return value || undefined;
  } catch (err) {
    if (err.code === "ENOENT" || err.code === "ENOTDIR") return undefined;
    return undefined;
  }
}

function coderConfigDir(env) {
  return env.CODER_CONFIG_DIR || path.join(os.homedir(), ".config", "coderv2");
}

function resolveBaseUrl(env) {
  return normalizeBaseUrl(
    required(
      "CODER_URL",
      env.CODER_URL || env.CODER_AGENT_URL || readFileIfPresent(path.join(coderConfigDir(env), "url")),
      "CODER_AGENT_URL",
    ),
  );
}

function sessionTokenFromCoderCli(env) {
  try {
    const coderBinary = env.CODER_PORT_SHARE_CODER_BINARY || "coder";
    return execFileSync(coderBinary, ["login", "token"], {
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim() || undefined;
  } catch (_err) {
    return undefined;
  }
}

function resolveSessionToken(env) {
  if (env.CODER_SESSION_TOKEN) return env.CODER_SESSION_TOKEN;

  const cliToken = sessionTokenFromCoderCli(env);
  if (cliToken) return cliToken;

  const fileToken = readFileIfPresent(path.join(coderConfigDir(env), "session"));
  if (fileToken) return fileToken;

  throw new Error(
    "No Coder user session token found. Run `coder login <url>` or set CODER_SESSION_TOKEN. " +
      "CODER_AGENT_TOKEN is an agent token and cannot authenticate the port-share API.",
  );
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

  const baseUrl = resolveBaseUrl(process.env);
  const token = resolveSessionToken(process.env);
  const workspaceId = required("CODER_WORKSPACE_ID", process.env.CODER_WORKSPACE_ID);
  const agentName = process.env.CODER_WORKSPACE_AGENT_NAME || "main";

  const headers = {
    "Coder-Session-Token": token,
    "Content-Type": "application/json",
  };

  const ownerName = await resolveOwnerName({
    baseUrl,
    headers,
    ownerName: process.env.CODER_WORKSPACE_OWNER_NAME,
  });

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
