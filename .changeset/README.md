# Changesets

This directory tracks pending version bumps via [Changesets](https://github.com/changesets/changesets).

We do not publish this package to npm — `s3-adaptor` is consumed by `veysur` purely via the
pnpm `workspace:*` protocol. "Release" here means: bump `package.json`'s version, write a
`CHANGELOG.md` entry, tag the repo, and cut a GitHub release. See the root `AGENTS.md`
"Releases" section for the full flow.

Read the [Changesets documentation](https://github.com/changesets/changesets/tree/main/docs) for more information.
