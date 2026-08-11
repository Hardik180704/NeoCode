# Developing NeoCode

This guide describes a reproducible local environment for contributing to the
NeoCode monorepo. Documentation and landing-page changes do not require the API
services, but server and end-to-end work does.

## Prerequisites

- Git
- Bun 1.3.13
- PostgreSQL 15 or newer for server development
- Docker or another local PostgreSQL installation (optional, but convenient)

The required Bun version is also pinned in the root `package.json`. Install the
workspace exactly as locked:

```sh
bun install --frozen-lockfile
cp .env.example .env
```

Only populate the variables needed for the area you are changing. Never commit
`.env` or any real credential.

## Local PostgreSQL

If Docker is available, start an isolated development database:

```sh
docker run --name neocode-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=neocode \
  -p 5432:5432 \
  -d postgres:16-alpine
```

Set this value in `.env`:

```dotenv
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/neocode
```

Generate the Prisma client and apply the current schema:

```sh
bun run db:generate
bun run db:push
```

Later sessions can restart the same container with:

```sh
docker start neocode-postgres
```

## Service credentials

The landing page, shared package, and most NeoLens tests need no external
credentials. Running the full local API requires:

- `DATABASE_URL` for PostgreSQL.
- Clerk server and OAuth values for authentication.
- Polar sandbox values for checkout, portal, and credit-meter behavior.
- At least one provider key (`ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) for chat.

Sentry is optional in local development. Leave `SENTRY_DSN` empty to disable
reporting. NeoCode does not send default personally identifiable information.

Use sandbox or development projects only. The variable names and safe defaults
are listed in `.env.example`.

## Running packages

Run each process in its own terminal:

```sh
bun run dev:server
bun run dev:cli
bun run dev:web
```

The API listens on port 3000 and the Vite development server normally listens
on port 5173. Set `API_URL=http://localhost:3000` when the CLI should use the
local API instead of the hosted service.

## Quality checks

Run the same core quality gate used by contributors and CI:

```sh
bun run check
```

Individual commands are available when iterating:

```sh
bun run lint
bun run typecheck
bun test
bun run build:web
```

After staging files, format only the intended contribution with:

```sh
bun run format
```

For release and installer changes, follow `docs/RELEASING.md` and run the
relevant platform smoke tests.
