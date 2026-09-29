#!/usr/bin/env bash
set -euo pipefail

# Cuts a release from pending changesets. Single-package repo, so this always
# produces one tag: s3-adaptor@<version>.
#
# Mechanical steps only: version bump, commit, tag, push. GitHub release
# creation is left as a manual step (printed at the end) since changelog
# entries don't extract cleanly enough to automate reliably.

cd "$(dirname "$0")/.."

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree not clean. Commit or stash changes first." >&2
  exit 1
fi

if ! ls .changeset/*.md >/dev/null 2>&1; then
  echo "No pending changesets in .changeset/ — nothing to release." >&2
  exit 1
fi

pnpm changeset version

if git diff --quiet -- package.json; then
  echo "changeset version produced no version bump." >&2
  exit 1
fi

git add -A
git commit -m "chore(release): version packages"
git push

VERSION=$(node -p "require('./package.json').version")
TAG="s3-adaptor@${VERSION}"
git tag "$TAG"
git push --tags

echo
echo "Tagged and pushed: $TAG"
echo
echo "Then publish to npm with ./scripts/publish.sh (run it with --dry-run first)."
echo
echo "Next: cut a GitHub release from the CHANGELOG.md entry, e.g.:"
echo "  gh release create '$TAG' --title '$TAG' --notes-file <(sed -n '/^## ${VERSION}\$/,/^## /p' CHANGELOG.md | sed '\$d')"
