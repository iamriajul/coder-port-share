# coder-port-share

Share a Coder workspace port publicly — no npm install required.

## Usage

```bash
npx --yes github:iamriajul/coder-port-share [workspace] <port> [level]
```

When running inside a Coder workspace, `workspace` defaults to `CODER_WORKSPACE_NAME`.
The agent name defaults to `CODER_WORKSPACE_AGENT_NAME`, falling back to `main`.

## Examples

```bash
# Inside a Coder workspace, use CODER_WORKSPACE_NAME automatically
npx --yes github:iamriajul/coder-port-share 3000
npx --yes github:iamriajul/coder-port-share 3000 authenticated
npx --yes github:iamriajul/coder-port-share 3000 owner

# Or pass the workspace explicitly
npx --yes github:iamriajul/coder-port-share em 3000
npx --yes github:iamriajul/coder-port-share em 3000 authenticated
```

## Share Levels

| Level | Access |
|-------|--------|
| `public` (default) | Anyone with the URL |
| `authenticated` | Any logged-in Coder user |
| `owner` | Only you |

## Requirements

| Variable | Description |
|----------|-------------|
| `CODER_AGENT_URL` | Your Coder deployment URL. Preferred in current Coder workspace environments. |
| `CODER_AGENT_TOKEN` | Token used with the `Coder-Session-Token` header. Preferred in current Coder workspace environments. |
| `CODER_WORKSPACE_NAME` | Default workspace name when the CLI is called as `<port> [level]`. |
| `CODER_WORKSPACE_ID` | Optional workspace ID; skips the workspace lookup when present. |
| `CODER_WORKSPACE_AGENT_NAME` | Optional agent name for the port share and app URL; defaults to `main`. |
| `CODER_WORKSPACE_OWNER_NAME` | Optional owner name for the app URL; skips the `/users/me` lookup when present. |
| `CODER_URL` | Legacy fallback for `CODER_AGENT_URL`. |
| `CODER_SESSION_TOKEN` | Legacy fallback for `CODER_AGENT_TOKEN`. |
