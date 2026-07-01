# coder-port-share

Share a Coder workspace port publicly — no npm install required.

## Usage

```bash
npx --yes github:iamriajul/coder-port-share <port> [level] [workspace]
```

The workspace ID comes from `CODER_WORKSPACE_ID`; the CLI does not resolve workspaces by name.
The workspace argument only overrides the name used to print the app URL; it defaults to `CODER_WORKSPACE_NAME`.
The agent name defaults to `CODER_WORKSPACE_AGENT_NAME`, falling back to `main`.
API authentication uses your Coder user session, the same session used by `coder whoami`.

## Examples

```bash
npx --yes github:iamriajul/coder-port-share 3000
npx --yes github:iamriajul/coder-port-share 3000 authenticated
npx --yes github:iamriajul/coder-port-share 3000 owner
npx --yes github:iamriajul/coder-port-share 3000 authenticated deepcycle
```

## Share Levels

| Level | Access |
|-------|--------|
| `public` (default) | Anyone with the URL |
| `authenticated` | Any logged-in Coder user |
| `owner` | Only you |

## Requirements

| Variable / command | Description |
|--------------------|-------------|
| `CODER_WORKSPACE_ID` | Current workspace ID used for the port-share API call. Required. |
| `CODER_WORKSPACE_NAME` | Default workspace name used in the printed app URL when `[workspace]` is omitted. Required unless `[workspace]` is passed. |
| `CODER_WORKSPACE_AGENT_NAME` | Optional agent name for the port share and app URL; defaults to `main`. |
| `CODER_WORKSPACE_OWNER_NAME` | Optional owner name for the app URL; skips the `/users/me` lookup when present. |
| `CODER_URL` / `CODER_AGENT_URL` | Coder deployment URL. Falls back to the Coder config file URL when available. |
| `CODER_SESSION_TOKEN` | Optional user session token. If absent, the CLI asks `coder login token`, then falls back to the Coder config session file. |
| `coder login token` | Preferred way to reuse the same authenticated user session as `coder whoami`. |

`CODER_AGENT_TOKEN` is not a Coder user session token and is not used for the port-share API.
