const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const cliPath = path.join(__dirname, "..", "index.js");
const skillPath = path.join(__dirname, "..", "SKILL.md");

function runCli(args, env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ...env,
      },
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function tempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function fakeCoderBinDir(t, token = "user-session-token") {
  const dir = tempDir(t, "coder-port-share-bin-");
  const bin = path.join(dir, "coder");
  fs.writeFileSync(
    bin,
    `#!/bin/sh\nif [ "$1" = "login" ] && [ "$2" = "token" ]; then\n  printf '%s\\n' '${token}'\n  exit 0\nfi\nexit 42\n`,
  );
  fs.chmodSync(bin, 0o755);
  return dir;
}

function startMockCoder(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const recorded = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body,
      };
      requests.push(recorded);
      handler(recorded, res);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}/`,
        requests,
        close: () => new Promise((done) => server.close(done)),
      });
    });
  });
}

test("SKILL.md teaches coding agents the exact CLI contract", () => {
  const skill = fs.readFileSync(skillPath, "utf8");

  assert.match(skill, /npx --yes github:iamriajul\/coder-port-share <port> \[level\] \[workspace\]/);
  assert.match(skill, /CODER_WORKSPACE_ID/);
  assert.match(skill, /does not select or resolve the workspace by name/);
  assert.match(skill, /CODER_AGENT_URL/);
  assert.match(skill, /coder login token/);
  assert.match(skill, /CODER_SESSION_TOKEN/);
  assert.match(skill, /CODER_AGENT_TOKEN.*not a user session token/);
  assert.match(skill, /CODER_WORKSPACE_AGENT_NAME/);
});

test("accepts port, level, workspace order without resolving workspace by name", async (t) => {
  const workspaceId = "0a9cfc12-4b0a-4b9b-8f29-5931938caa18";
  const coderBinDir = fakeCoderBinDir(t, "user-session-token");
  const mock = await startMockCoder((req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, `/api/v2/workspaces/${workspaceId}/port-share`);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  t.after(() => mock.close());

  const result = await runCli(["3000", "authenticated", "custom-workspace"], {
    PATH: `${coderBinDir}:${process.env.PATH}`,
    CODER_AGENT_URL: mock.baseUrl,
    CODER_AGENT_TOKEN: "not-a-user-session-token",
    CODER_WORKSPACE_ID: workspaceId,
    CODER_WORKSPACE_NAME: "deepcycle",
    CODER_WORKSPACE_AGENT_NAME: "dev-agent",
    CODER_WORKSPACE_OWNER_NAME: "iamriajul",
  });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(mock.requests.length, 1);

  const post = mock.requests[0];
  assert.equal(post.headers["coder-session-token"], "user-session-token");
  assert.deepEqual(JSON.parse(post.body), {
    agent_name: "dev-agent",
    port: 3000,
    share_level: "authenticated",
    protocol: "http",
  });
  assert.match(
    result.stdout.trim(),
    /^https:\/\/3000--dev-agent--custom-workspace--iamriajul\.127\.0\.0\.1:\d+\/$/,
  );
});

test("requires CODER_WORKSPACE_ID instead of resolving workspace by name", async (t) => {
  const coderBinDir = fakeCoderBinDir(t);
  const mock = await startMockCoder((_req, res) => {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "unexpected request" }));
  });
  t.after(() => mock.close());

  const result = await runCli(["3000"], {
    PATH: `${coderBinDir}:${process.env.PATH}`,
    CODER_AGENT_URL: mock.baseUrl,
    CODER_WORKSPACE_NAME: "deepcycle",
    CODER_WORKSPACE_AGENT_NAME: "dev-agent",
    CODER_WORKSPACE_OWNER_NAME: "iamriajul",
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /CODER_WORKSPACE_ID is not set/);
  assert.equal(mock.requests.length, 0);
});

test("keeps CODER_SESSION_TOKEN fallback when current workspace env is present", async (t) => {
  const workspaceId = "11111111-2222-3333-4444-555555555555";
  const mock = await startMockCoder((req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, `/api/v2/workspaces/${workspaceId}/port-share`);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  t.after(() => mock.close());

  const result = await runCli(["8080", "owner", "custom"], {
    CODER_URL: mock.baseUrl,
    CODER_SESSION_TOKEN: "legacy-session-token",
    CODER_AGENT_TOKEN: "not-a-user-session-token",
    CODER_WORKSPACE_ID: workspaceId,
    CODER_WORKSPACE_NAME: "env-workspace",
    CODER_WORKSPACE_AGENT_NAME: "main",
    CODER_WORKSPACE_OWNER_NAME: "legacy-user",
  });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(mock.requests.length, 1);
  const post = mock.requests[0];
  assert.equal(post.headers["coder-session-token"], "legacy-session-token");
  assert.deepEqual(JSON.parse(post.body), {
    agent_name: "main",
    port: 8080,
    share_level: "owner",
    protocol: "http",
  });
  assert.match(result.stdout.trim(), /^https:\/\/8080--main--custom--legacy-user\.127\.0\.0\.1:\d+\/$/);
});

test("does not treat CODER_AGENT_TOKEN as API session auth", async (t) => {
  const workspaceId = "22222222-3333-4444-5555-666666666666";
  const emptyBinDir = tempDir(t, "coder-port-share-empty-bin-");
  const homeDir = tempDir(t, "coder-port-share-home-");
  const mock = await startMockCoder((_req, res) => {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "unexpected request" }));
  });
  t.after(() => mock.close());

  const result = await runCli(["3000", "public"], {
    PATH: emptyBinDir,
    HOME: homeDir,
    CODER_AGENT_URL: mock.baseUrl,
    CODER_AGENT_TOKEN: "agent-token-only",
    CODER_WORKSPACE_ID: workspaceId,
    CODER_WORKSPACE_NAME: "deepcycle",
    CODER_WORKSPACE_AGENT_NAME: "main",
    CODER_WORKSPACE_OWNER_NAME: "iamriajul",
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /No Coder user session token found/);
  assert.match(result.stderr, /CODER_AGENT_TOKEN is an agent token/);
  assert.equal(mock.requests.length, 0);
});
