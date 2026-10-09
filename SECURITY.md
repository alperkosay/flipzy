# Security Policy

## Supported versions

Only the latest minor release receives security fixes.

## Reporting a vulnerability

Please do **not** open a public issue. Use GitHub's private vulnerability reporting
("Security" tab → "Report a vulnerability").

You will get an answer within 3 working days. Confirmed issues are fixed in a patch
release and disclosed in a GitHub Security Advisory once the fix is available.

## What we do to keep the package safe

- No runtime dependencies; development dependencies are checked with `npm audit` on every push and updated weekly by Dependabot.
- No `eval`, `new Function`, `innerHTML` or `dangerouslySetInnerHTML`; lint rules and a package scan enforce this.
- All numeric props are validated and clamped, so malformed input cannot crash the host page.
- The published tarball contains only `dist/`, `README.md`, `LICENSE`, `CHANGELOG.md` and `package.json`, verified before every release.
- Releases are built and published by GitHub Actions via npm Trusted Publishing, with provenance attestations. No long-lived npm token exists.
- GitHub Actions are pinned to commit SHAs; CodeQL and OpenSSF Scorecard run on every change.
