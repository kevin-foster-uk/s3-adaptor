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
- **Testing**: Colocated tests in `src/**/*.test.ts`
