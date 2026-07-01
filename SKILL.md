---
name: coder-port-share
description: Use this CLI from inside a Coder workspace to publish a workspace agent HTTP port through Coder port sharing and print the share URL.
---

# coder-port-share

## When to use

Use `coder-port-share` when all of these are true:

1. You are running inside a Coder workspace.
2. A local HTTP service is already listening on a workspace port.
3. You need Coder to create or update a port-share entry for that port.
4. You want a share URL without opening the Coder dashboard or writing raw API calls.

Do not use it for non-Coder machines, raw TCP/UDP services, HTTPS termination, or selecting a different workspace by name.

## Command

```bash
npx --yes github:iamriajul/coder-port-share <port> [level] [workspace]
```

Arguments:

- `<port>`: required local HTTP port to share. Must be an integer from 9 to 65535.
- `[level]`: optional Coder share level. One of `public`, `authenticated`, or `owner`. Defaults to `public`.
- `[workspace]`: optional workspace name used only in the printed app URL. It defaults to `CODER_WORKSPACE_NAME`; it does not select or resolve the workspace by name.

## Environment contract

The CLI is designed for current Coder workspace agent environments:

- `CODER_AGENT_URL`: Coder deployment URL. Preferred. Falls back to legacy `CODER_URL`.
- `CODER_AGENT_TOKEN`: token sent as the `Coder-Session-Token` header. Preferred. Falls back to legacy `CODER_SESSION_TOKEN`.
- `CODER_WORKSPACE_ID`: required workspace UUID used directly in `/api/v2/workspaces/{workspace_id}/port-share`.
- `CODER_WORKSPACE_NAME`: default workspace name for URL printing when `[workspace]` is omitted.
- `CODER_WORKSPACE_AGENT_NAME`: workspace agent name for the API payload and URL. Defaults to `main` if missing.
- `CODER_WORKSPACE_OWNER_NAME`: owner name for URL printing. If missing, the CLI calls `/api/v2/users/me` to resolve the username.

Important: `CODER_WORKSPACE_ID` is the source of truth for the API call. The optional `[workspace]` argument and `CODER_WORKSPACE_NAME` are display-only URL components.

## What the CLI does

1. Parses `<port> [level] [workspace]`.
2. Reads Coder URL, token, workspace ID, workspace name, agent name, and owner name from the environment.
3. Posts this JSON body to `${CODER_AGENT_URL}/api/v2/workspaces/${CODER_WORKSPACE_ID}/port-share`:

   ```json
   {
     "agent_name": "<CODER_WORKSPACE_AGENT_NAME or main>",
     "port": 3000,
     "share_level": "public",
     "protocol": "http"
   }
   ```

4. Prints the app URL:

   ```text
   https://<port>--<agent>--<workspace>--<owner>.<coder-domain>/
   ```

## Examples

Share port 3000 publicly using workspace/agent defaults:

```bash
npx --yes github:iamriajul/coder-port-share 3000
```

Share port 3000 to authenticated Coder users:

```bash
npx --yes github:iamriajul/coder-port-share 3000 authenticated
```

Share port 3000 to the owner only:

```bash
npx --yes github:iamriajul/coder-port-share 3000 owner
```

Override only the workspace name in the printed URL:

```bash
npx --yes github:iamriajul/coder-port-share 3000 authenticated deepcycle
```

## Pitfalls for coding agents

- Do not add a workspace-name lookup. The API path must use `CODER_WORKSPACE_ID` directly.
- Do not treat `[workspace]` as a selector for a different workspace. It only affects the printed URL.
- Do not hardcode `main` unless `CODER_WORKSPACE_AGENT_NAME` is absent.
- Do not print or log `CODER_AGENT_TOKEN` / `CODER_SESSION_TOKEN`.
- Keep the argument order exactly `<port> [level] [workspace]`; the old `<workspace> <port> [level]` shape is intentionally not supported.

## Verification

After modifying this program, run:

```bash
npm run test
node --check index.js
node --check test/index.test.js
```

The tests should assert that:

- the CLI accepts `<port> [level] [workspace]`,
- no workspace-name resolution request is made,
- `CODER_WORKSPACE_ID` is required before network calls,
- current `CODER_AGENT_*` env vars are preferred while legacy fallbacks still work.
