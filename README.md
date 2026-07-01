# coder-port-share

Share a Coder workspace port publicly — no npm install required.

## Usage

```bash
npx --yes github:iamriajul/coder-port-share <port> [level] [workspace]
```

The workspace ID comes from `CODER_WORKSPACE_ID`; the CLI does not resolve workspaces by name.
The workspace argument only overrides the name used to print the app URL; it defaults to `CODER_WORKSPACE_NAME`.
The agent name defaults to `CODER_WORKSPACE_AGENT_NAME`, falling back to `main`.

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

| Variable | Description |
|----------|-------------|
| `CODER_AGENT_URL` | Your Coder deployment URL. Preferred in current Coder workspace environments. |
| `CODER_AGENT_TOKEN` | Token used with the `Coder-Session-Token` header. Preferred in current Coder workspace environments. |
| `CODER_WORKSPACE_ID` | Current workspace ID used for the port-share API call. Required. |
| `CODER_WORKSPACE_NAME` | Default workspace name used in the printed app URL when `[workspace]` is omitted. Required unless `[workspace]` is passed. |
| `CODER_WORKSPACE_AGENT_NAME` | Optional agent name for the port share and app URL; defaults to `main`. |
| `CODER_WORKSPACE_OWNER_NAME` | Optional owner name for the app URL; skips the `/users/me` lookup when present. |
| `CODER_URL` | Legacy fallback for `CODER_AGENT_URL`. |
| `CODER_SESSION_TOKEN` | Legacy fallback for `CODER_AGENT_TOKEN`. |
