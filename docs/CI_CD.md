# CI/CD

Planned. Same conventions as [charted-sea-client](../../charted-sea-client/docs/CI_CD.md): actions pinned to SHAs, read-only default permissions, one local gate (`npm run check`) that mirrors CI.

| File | Trigger | What it does |
|---|---|---|
| `ci.yml` | push to `main`, every PR | `verify`: commitlint, format, lint, typecheck, `check:deps`, `check:dupes`, `check:unused`. `test`: `test:coverage` on Node 20, 22, 24. `package`: build, `publint`, start the packed tarball over stdio and run the MCP Inspector CLI `tools/list` against it. |
| `codeql.yml` | PR, push, weekly | CodeQL for TypeScript. |
| `security.yml` | PR, push | gitleaks; dependency review on PRs. |
| `scorecard.yml` | weekly | OpenSSF Scorecard. |
| `release.yml` | push to `main` | Changesets version PR → `npm publish --provenance`; then build a multi-arch (amd64, arm64) Docker image, push to `ghcr.io/<owner>/charted-sea-mcp` with SBOM and provenance attestations, and sign it with cosign (keyless). |
| `live-smoke.yml` | `workflow_dispatch` only | Live tests in the protected `live` environment with `CHARTED_SEA_TOKEN`. |

## Dependency on the client

`charted-sea-client` is a normal npm dependency with a caret range. Until the client's 0.1.0 is published, CI installs it from a git tag. Dependabot raises client updates like any other dependency.

## Docker image

Distroless Node base, non-root user, `MCP_TRANSPORT=http` by default inside the container, `HEALTHCHECK` on `/healthz`. The image is a convenience; `npx` stays the main install path.

## MCP registry

After 0.1.0 and Marc's agreement, publish `server.json` to the official MCP registry from `release.yml`.
