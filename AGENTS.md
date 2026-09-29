# AGENTS.md

### Committing Changes

- `pnpm commit` - Interactive guided commit prompt (commitizen). Prompts for type, scope, and summary. `feat` and `fix` get additional prompts for body, breaking changes, and issue references.
- Commit scopes are predefined (custom scopes disallowed). Add new scopes to `.cz-config.js` as needed.
- Both source code and commit messages are spell-checked via cspell (en-GB). Staged files are checked by a `pre-commit` hook; commit messages by a `commit-msg` hook. Bypass with `git commit --no-verify` if needed.
- **Spell-check suppressions**: prefer inline ignores over adding to `.cspell-words.txt`:
  - File-specific terms: use `// cspell:ignore term` inline or at the top of the file
  - Whole file (e.g. generated files): use `// cspell:disable` at the top
  - Genuinely project-wide terms only: add to `.cspell-words.txt`

### Code Style

- **Formatting**: Prettier with 2 spaces, no semicolons, single quotes, trailing commas
- **Imports**: ES6 modules, prefer named imports
- **Testing**: Colocated tests in `src/**/*.test.ts`. Jest is configured to fail a test on
  any unexpected `console.error`/`console.warn` call, via `installConsoleGuard()` wired into
  `setupFilesAfterEnv` (`src/test-utils/consoleGuard.ts`, `src/test-utils/setupTests.ts`).
  Allow an expected call through with `allowConsole(pattern, fn)` (scoped to one test) or by
  adding the pattern to `KNOWN_BENIGN_PATTERNS` in `consoleGuard.ts` (package-wide, for
  warnings that are environmental/unfixable and will recur - comment why). Don't use a raw
  `jest.spyOn(console, 'warn'|'error')`.

### Writing Style

No em-dashes anywhere in this repository: prose, docs, code comments, commit messages, PR
descriptions. Use a comma, colon, semicolon, or a full stop and a new sentence instead. It's
the single most common tell in AI-generated writing, so treat it as a hard rule, not a style
preference.

### Releases

Versioned independently via [Changesets](https://github.com/changesets/changesets)
(`.changeset/`). Published to npm as `s3-adaptor`; `veysur` consumes it via the pnpm
`workspace:*` protocol from this submodule.

- When a PR changes behaviour, add a changeset: `pnpm changeset`, picking a bump level
  (patch/minor/major) and writing a changelog summary.
- To cut a release: `./scripts/release.sh`. Runs `pnpm changeset version`, commits, tags
  `s3-adaptor@<version>`, and pushes. Prints the `gh release create` command to run
  afterwards.
- To publish to npm: `./scripts/publish.sh --dry-run` first (build, test, and list the
  tarball), then `./scripts/publish.sh`. It refuses to publish a version already on the
  registry. Needs `npm login` and an npm token (prompted, or set `NPM_TOKEN`).
- Manual, maintainer-triggered flow for now: no CI release automation yet.
