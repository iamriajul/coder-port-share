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

## Environment/auth contract

The CLI is designed for current Coder workspace environments:

- `CODER_WORKSPACE_ID`: required workspace UUID used directly in `/api/v2/workspaces/{workspace_id}/port-share`.
- `CODER_WORKSPACE_NAME`: default workspace name for URL printing when `[workspace]` is omitted.
- `CODER_WORKSPACE_AGENT_NAME`: workspace agent name for the API payload and URL. Defaults to `main` if missing.
- `CODER_WORKSPACE_OWNER_NAME`: owner name for URL printing. If missing, the CLI calls `/api/v2/users/me` to resolve the username.
- `CODER_URL` / `CODER_AGENT_URL`: Coder deployment URL. Falls back to the Coder config file URL when available.
- `CODER_SESSION_TOKEN`: optional user session token. If absent, the CLI asks `coder login token`, then falls back to the Coder config session file.

Important: `CODER_AGENT_TOKEN` is not a user session token and cannot authenticate the port-share API. It is intentionally ignored for API auth. The API token should be the same user session used by `coder whoami`.

Important: `CODER_WORKSPACE_ID` is the source of truth for the API call. The optional `[workspace]` argument and `CODER_WORKSPACE_NAME` are display-only URL components.

## What the CLI does

1. Parses `<port> [level] [workspace]`.
2. Reads Coder URL, user session token, workspace ID, workspace name, agent name, and owner name from the environment/CLI config.
3. Posts this JSON body to `${CODER_URL or CODER_AGENT_URL}/api/v2/workspaces/${CODER_WORKSPACE_ID}/port-share`:

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

- Do not use `CODER_AGENT_TOKEN` as the `Coder-Session-Token`; it is not a user session token.
- Do not add a workspace-name lookup. The API path must use `CODER_WORKSPACE_ID` directly.
- Do not treat `[workspace]` as a selector for a different workspace. It only affects the printed URL.
- Do not hardcode `main` unless `CODER_WORKSPACE_AGENT_NAME` is absent.
- Do not print or log `CODER_SESSION_TOKEN`, `coder login token` output, or config session file contents.
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
- current workspace env vars are used for workspace identity and URL,
- user session auth is read from `CODER_SESSION_TOKEN`, `coder login token`, or the Coder config session file,
- `CODER_AGENT_TOKEN` is not used as API session auth.
