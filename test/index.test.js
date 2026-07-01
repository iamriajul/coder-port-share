const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const http = require("node:http");
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
  assert.match(skill, /CODER_AGENT_TOKEN/);
  assert.match(skill, /CODER_WORKSPACE_AGENT_NAME/);
});

test("accepts port, level, workspace order without resolving workspace by name", async (t) => {
  const workspaceId = "0a9cfc12-4b0a-4b9b-8f29-5931938caa18";
  const mock = await startMockCoder((req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, `/api/v2/workspaces/${workspaceId}/port-share`);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });
  t.after(() => mock.close());

  const result = await runCli(["3000", "authenticated", "custom-workspace"], {
    CODER_AGENT_URL: mock.baseUrl,
    CODER_AGENT_TOKEN: "agent-token",
    CODER_WORKSPACE_ID: workspaceId,
    CODER_WORKSPACE_NAME: "deepcycle",
    CODER_WORKSPACE_AGENT_NAME: "dev-agent",
    CODER_WORKSPACE_OWNER_NAME: "iamriajul",
  });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(mock.requests.length, 1);

  const post = mock.requests[0];
  assert.equal(post.headers["coder-session-token"], "agent-token");
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
  const mock = await startMockCoder((_req, res) => {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "unexpected request" }));
  });
  t.after(() => mock.close());

  const result = await runCli(["3000"], {
    CODER_AGENT_URL: mock.baseUrl,
    CODER_AGENT_TOKEN: "agent-token",
    CODER_WORKSPACE_NAME: "deepcycle",
    CODER_WORKSPACE_AGENT_NAME: "dev-agent",
    CODER_WORKSPACE_OWNER_NAME: "iamriajul",
  });

  assert.equal(result.code, 1);
  assert.match(result.stderr, /CODER_WORKSPACE_ID is not set/);
  assert.equal(mock.requests.length, 0);
});

test("keeps legacy URL and token fallbacks when current workspace env is present", async (t) => {
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
    CODER_SESSION_TOKEN: "legacy-token",
    CODER_WORKSPACE_ID: workspaceId,
    CODER_WORKSPACE_NAME: "env-workspace",
    CODER_WORKSPACE_AGENT_NAME: "main",
    CODER_WORKSPACE_OWNER_NAME: "legacy-user",
  });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(mock.requests.length, 1);
  const post = mock.requests[0];
  assert.equal(post.headers["coder-session-token"], "legacy-token");
  assert.deepEqual(JSON.parse(post.body), {
    agent_name: "main",
    port: 8080,
    share_level: "owner",
    protocol: "http",
  });
  assert.match(result.stdout.trim(), /^https:\/\/8080--main--custom--legacy-user\.127\.0\.0\.1:\d+\/$/);
});
