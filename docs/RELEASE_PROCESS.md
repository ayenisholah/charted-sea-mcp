# Release process

Same flow as [charted-sea-client](../../charted-sea-client/docs/RELEASE_PROCESS.md): SemVer, a changeset per user-visible change, a "Version packages" PR, and npm publish with provenance on merge.

## Extra for this project

- Tool names, input schemas and annotations are the public API. Renaming a tool or removing an input is a major change (minor before 1.0, with a changelog migration note).
- Each release also pushes `ghcr.io/<owner>/charted-sea-mcp:X.Y.Z` and `:latest`, signed, with SBOM.

## Before the first publish (0.1.0)

- [ ] charted-sea-client 0.1.0 is published.
- [ ] Marc has agreed to the name.
- [ ] Tested by hand in Claude Code and Cursor; screenshots or a short recording added to the README.
- [ ] Live smoke test passed.
- [ ] README says "unofficial" above the fold.
