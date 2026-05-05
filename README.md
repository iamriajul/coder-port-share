# coder-port-share

Share a Coder workspace port publicly — no npm install required.

## Usage

```bash
npx --yes github:iamriajul/coder-port-share <workspace> <port> [level]
```

## Examples

```bash
npx --yes github:iamriajul/coder-port-share em 3000
npx --yes github:iamriajul/coder-port-share em 3000 authenticated
npx --yes github:iamriajul/coder-port-share em 3000 owner
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
| `CODER_URL` | Your Coder deployment URL |
| `CODER_SESSION_TOKEN` | Your Coder session token |
