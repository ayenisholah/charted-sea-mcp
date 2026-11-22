# CI/CD

Same conventions as [charted-sea-client](../../charted-sea-client/docs/CI_CD.md): actions pinned to SHAs, read-only default permissions, one local gate (`npm run check`) that mirrors CI.

| File | Trigger | What it does |
|---|---|---|
| `ci.yml` | push to `main`, every PR | `verify`: commitlint, format, lint, typecheck, `check:deps`, `check:dupes`, `check:unused`. `test`: `test:coverage` on Node 22 and 24. `package`: build, `publint`, stdio smoke test (startup time, missing-token failure), then the MCP Inspector CLI `tools/list` against the packed tarball. `docker`: build the image, check `/healthz`, `tools/list` over HTTP, 401 without a token, and the `nonroot` user. |
| `codeql.yml` | PR, push, weekly | CodeQL for TypeScript. |
| `security.yml` | PR, push | gitleaks; dependency review on PRs. |
| `scorecard.yml` | weekly | OpenSSF Scorecard. |
| `release.yml` | push to `main` | If `package.json` holds a version not yet on npm (merged from a `release/X.Y.Z` PR): `npm publish --provenance` via trusted publishing, GitHub release, then a multi-arch (amd64, arm64) image pushed to `ghcr.io/<owner>/charted-sea-mcp` with SBOM and provenance attestations, signed with cosign (keyless). |
| `live-smoke.yml` | `workflow_dispatch` only | Live tests in the protected `live` environment with `CHARTED_SEA_TOKEN`. |

## Dependency on the client

`charted-sea-client` is a normal npm dependency (`^0.2.0`, the first version that reads the live API's page shape). Dependabot raises client updates like any other dependency.

## Docker image

Distroless Node base, non-root user, `MCP_TRANSPORT=http` by default inside the container, `HEALTHCHECK` on `/healthz`. The image is a convenience; `npx` stays the main install path.

## MCP registry

After 0.1.0 and Marc's agreement, publish `server.json` to the official MCP registry from `release.yml`.
