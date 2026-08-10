# NEOCODE

Neocode is a terminal coding agent with streaming responses, persistent sessions,
PLAN/BUILD modes, local repository tools, and optional Model Context Protocol
(MCP) integrations.

## Install

### Homebrew (macOS and Linux)

```sh
brew install Hardik180704/tap/neocode
```

### macOS and Linux installer

```sh
curl -fsSL https://raw.githubusercontent.com/Hardik180704/NeoCode/main/install.sh | sh
```

Alpine Linux users must install the C++ runtime libraries first:

```sh
apk add --no-cache libstdc++ libgcc
```

### Windows PowerShell

```powershell
irm https://raw.githubusercontent.com/Hardik180704/NeoCode/main/install.ps1 | iex
```

Then start NeoCode from a project directory:

```sh
cd path/to/project
neocode
```

Standalone binaries are also available from the repository's GitHub Releases.
They include the Bun runtime; users do not need to install Bun or Node.js.

Current binaries are unsigned. macOS may require approval in Privacy & Security,
and Windows may display a Microsoft Defender SmartScreen warning. Published
SHA-256 checksums and GitHub attestations can be used to verify each download.

Use `API_URL` to override the production API endpoint for development.

## Development

```sh
bun install
bun run dev:server
bun run dev:cli
bun run dev:web
```

See [docs/RELEASING.md](docs/RELEASING.md) for the release and Homebrew process.

## MCP integrations

Neocode discovers MCP servers from `.neocode/mcp.json` in the active project.
Configuration is optional; without it, all existing local tools behave exactly as
before.

Start from the included example:

```sh
mkdir -p .neocode
cp .neocode/mcp.example.json .neocode/mcp.json
```

Every MCP tool is denied by default and must have an explicit access policy:

- `read`: available in PLAN and BUILD modes
- `write`: available only in BUILD mode
- `disabled`: never exposed to the model

The special `"*"` policy can classify every otherwise-unlisted tool from a server,
but explicit per-tool policies are recommended.

Secrets should use environment references such as `${env:GITHUB_TOKEN}`. Resolved
secret values stay in the server process and are not returned by the MCP inspection
API. Local stdio servers receive only a small safe set of inherited process variables
plus variables declared in their own `env` block.

Inside an active session, run `/mcp` to inspect connection state, discovered tools,
and their access classifications.

Supported transports:

- `stdio` for local MCP server processes
- Streamable HTTP for remote MCP servers

MCP clients are scoped to a response or inspection request and always closed after
completion, failure, or interruption.
