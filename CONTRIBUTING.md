# Contributing

Thanks for helping. This is an unofficial project and not affiliated with Charted Sea.

## Setup

```sh
nvm use               # Node version from .nvmrc
npm ci
cp .env.example .env  # only needed for the live smoke test
npm run check         # every gate; must pass before a PR
```

## Workflow

1. Open an issue first for anything bigger than a bug fix, so we agree on the approach.
2. Branch from `main` (`feat/…`, `fix/…`, `docs/…`).
3. Write the failing test first. See [test strategy](docs/TEST_STRATEGY.md).
4. Run `npm run check`. CI runs the same gate and blocks the merge if it fails.
5. Use [Conventional Commits](https://www.conventionalcommits.org) (`feat:`, `fix:`, `docs:` …). commitlint checks them in CI.
6. Add a changeset (`npx changeset`) for any change users will notice.

## Rules that reviews enforce

- Behaviour matches [the spec](docs/SPEC.md). If the API behaves differently, update the spec in the same PR and link the evidence.
- Coverage stays at 100% per file. Don't add coverage exclusions to get past the gate.
- No real tokens, proxy credentials, or customer data in code, fixtures or issues.
- Docs state what is true now. Mark anything unbuilt as planned.
