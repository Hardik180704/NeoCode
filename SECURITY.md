# Security Policy

NeoCode handles local source code, authentication tokens, AI-provider requests,
billing state, and optional MCP tools. Please report suspected vulnerabilities
privately so users can be protected before details are published.

## Supported versions

Security fixes are provided for the latest published release and the current
`main` branch. Upgrade to the newest release before reporting a problem that may
already have been fixed.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/Hardik180704/NeoCode/security/advisories/new).
Do not open a public issue for an unpatched vulnerability.

Include, when applicable:

- The affected NeoCode version, operating system, and installation method.
- A minimal reproduction or proof of concept.
- The expected and observed security boundaries.
- Potential impact, including whether credentials or local files are exposed.
- Any suggested mitigation, without including real secrets or user data.

The maintainers aim to acknowledge reports within 72 hours and provide a status
update within seven days. Timelines for a fix and disclosure depend on severity
and release complexity.

## Scope

Reports involving path traversal, unsafe file access, authentication bypass,
credential disclosure, billing manipulation, installer integrity, dependency
compromise, or MCP permission bypass are especially valuable. Findings against
third-party services should be reported to the relevant provider unless NeoCode
is the source of the vulnerability.

Please allow a reasonable remediation period before public disclosure.
