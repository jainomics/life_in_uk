# Security baseline for Kingdom

Two files: `docs/SECURITY.md` (the policy Claude Code follows on every future
phase) and a one-off setup task to paste into Claude Code now, before Phase 1.

Context that shapes this: the MVP has no backend, no accounts, no server, and
no user data leaves the device — everything lives in the browser's IndexedDB.
That's a real security advantage: there's no server to breach, no database of
other people's data to leak, no auth system to get wrong. The exposure that
*does* exist is narrower than most apps: the npm supply chain, secrets in the
repo, and the small amount of data sitting on the user's own device.

---

## docs/SECURITY.md — paste this file into the repo directly

```markdown
# Security policy

## Dependency hygiene

- `pnpm-lock.yaml` is committed and is the source of truth. Never delete it
  to "fix" an install problem.
- Before adding any new dependency: check it has recent commits (within the
  last 12 months), a reasonable download count, and no open critical CVEs.
  Prefer packages already in wide use over niche alternatives — boring and
  popular beats clever and obscure.
- Pin exact versions for anything touching scheduling, storage, or content
  validation (the packages/core and packages/content dependencies). Caret
  ranges are fine for dev tooling (Vite, ESLint, Vitest).
- Run `pnpm audit` before every dependency addition and treat any high or
  critical finding as a blocker, not a note.
- No dependency that requires a postinstall script gets added without it
  being explicitly flagged and explained — postinstall scripts run arbitrary
  code on install and are the most common supply-chain attack vector in the
  npm ecosystem.
- Dependabot enabled on the repo (Settings → Code security → Dependabot) for
  automated vulnerability alerts and version PRs.

## CI gate

- A GitHub Action runs on every PR: `pnpm install --frozen-lockfile`,
  `pnpm lint`, `pnpm test`, `pnpm audit --audit-level=high`. Merge is blocked
  if any step fails.

## Secrets

- No API keys, tokens, or credentials are ever committed, including in
  comments, test fixtures, or example config. `.env*` is in `.gitignore`
  from Phase 0 onward.
- This app currently needs zero secrets to run (no backend, no third-party
  API calls). If that changes later, secrets go in the hosting platform's
  environment variable store (Cloudflare Pages), never in a file in the repo.
- GitHub secret scanning and push protection are enabled on the repo
  (Settings → Code security → Secret scanning).

## Data handling (client-side, local-first)

- All user data (progress, SRS state, attempts, mock results) stays in
  IndexedDB, scoped to the app's own origin by the browser — no other site
  or app can read it.
- No analytics, crash reporting, or telemetry library that phones data to a
  third party. The MVP's analytics (Phase 8) are local-only, written to the
  same IndexedDB, readable only at /dev/analytics.
- No third-party script tags, trackers, or embeds load in the app. If a CDN
  script is ever genuinely needed, it is pinned to an exact version and
  loaded with a Subresource Integrity (SRI) hash.
- Export/import (Phase 3) produces a plain JSON file the user explicitly
  downloads — the app never uploads it anywhere on their behalf.

## Web security headers

- A Content-Security-Policy is set (via Cloudflare Pages `_headers` file)
  restricting `script-src` to `'self'`, disallowing inline scripts and
  `eval`, and disallowing framing (`frame-ancestors 'none'`).
- HTTPS only, enforced by the hosting platform.
- Service worker (Phase 8) caches only same-origin assets.

## Review discipline

- At the end of any phase that adds a new dependency, the phase report must
  list every new package added and why.
```

---

## Setup task — paste into Claude Code before Phase 1

```
Before starting Phase 1, set up the security baseline for this repo.

1. Create docs/SECURITY.md with the exact content below. [paste the
   docs/SECURITY.md block above]

2. Add .gitignore entries for: .env, .env.*, node_modules, dist, .DS_Store,
   and any local Dexie/IndexedDB dump files.

3. Add a GitHub Actions workflow at .github/workflows/ci.yml that on every
   push and pull_request: checks out the repo, sets up Node 22 and pnpm,
   runs `pnpm install --frozen-lockfile`, then `pnpm lint`, `pnpm test`,
   `pnpm validate:content`, and `pnpm audit --audit-level=high` as separate
   steps so a failure is easy to locate.

4. Add apps/web/public/_headers (Cloudflare Pages headers file) setting:
   Content-Security-Policy: default-src 'self'; script-src 'self';
   style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';
   frame-ancestors 'none'
   (allow 'unsafe-inline' for style-src only if Tailwind's injected styles
   require it — tell me if you had to loosen anything and why).

5. Run `pnpm audit` now against whatever is currently in the lockfile and
   report the result.

Deliverable: docs/SECURITY.md committed, CI workflow passing on a trivial
commit, headers file in place, audit result reported.
```
