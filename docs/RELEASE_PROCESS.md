# Release process

Same flow as [charted-sea-client](../../charted-sea-client/docs/RELEASE_PROCESS.md): SemVer, a changeset per user-visible change, a `release/X.Y.Z` PR made with `npx changeset version`, and npm publish with provenance through trusted publishing when it merges. `main` only changes through pull requests.

## Extra for this project

- Tool names, input schemas and annotations are the public API. Renaming a tool or removing an input is a major change (minor before 1.0, with a changelog migration note).
- Each release also pushes `ghcr.io/<owner>/charted-sea-mcp:X.Y.Z` and `:latest`, signed, with SBOM.

## Before the first publish (0.1.0)

- [x] charted-sea-client is published (0.2.0, with provenance).
- [ ] Marc has agreed to the name.
- [ ] Tested by hand in Claude Code and Cursor; screenshots or a short recording added to the README.
- [x] Live smoke test passed (2026-11-22).
- [ ] npm trusted publishing configured for `charted-sea-mcp` (needs a first manual publish, as for the client).
- [ ] README says "unofficial" above the fold.
