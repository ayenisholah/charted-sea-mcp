# Release process

Same flow as [charted-sea-client](../../charted-sea-client/docs/RELEASE_PROCESS.md): SemVer, a changeset per user-visible change, a `release/X.Y.Z` PR made with `npx changeset version`, and npm publish with provenance through trusted publishing when it merges. `main` only changes through pull requests.

## Extra for this project

- Tool names, input schemas and annotations are the public API. Renaming a tool or removing an input is a major change (minor before 1.0, with a changelog migration note).
- Each release also pushes `ghcr.io/<owner>/charted-sea-mcp:X.Y.Z` and `:latest`, signed, with SBOM. The image job runs whenever that version's image isn't on GHCR yet, so re-running the workflow after a hand-published npm release still builds it.

## Before the first publish (0.1.0)

- [x] charted-sea-client is published (0.2.0, with provenance).
- [ ] Marc has agreed to the name.
- [ ] Tested by hand in Claude Code and Cursor; screenshots or a short recording added to the README.
- [x] Live smoke test passed (2026-11-22).
- [ ] npm trusted publishing configured for `charted-sea-mcp` (needs a first manual publish, as for the client).
- [ ] README says "unofficial" above the fold.

## First publish (0.1.0), step by step

Trusted publishing can only be added to a package that already exists, so the first version goes out by hand:

1. Merge the `release/0.1.0` PR. `release.yml` tries to publish and fails, because npm doesn't know this repo yet. That's expected.
2. On the merged `main`: `npm ci && npm publish --access public --auth-type=web` (approve in the browser).
3. On npmjs.com → charted-sea-mcp → Settings → Trusted Publisher → GitHub Actions: `ayenisholah` / `charted-sea-mcp` / `release.yml` / environment `npm` / tick **Allow npm publish**.
4. Re-run the failed `release.yml` run. npm is skipped (the version already exists), and the image job builds, pushes and signs `ghcr.io/ayenisholah/charted-sea-mcp:0.1.0`.
5. Later versions publish automatically when their release PR merges.
