# Pratik Patel — Personal Website

Personal website and blog built with React, TypeScript, Vite, and Tailwind CSS.

## Development

```bash
bun install
bun run dev
```

## End-to-end tests

```bash
bun run build      # the suite tests dist/, so it has to exist first
bun run test:e2e
```

Playwright serves `dist/` on a port derived from the path of the worktree it is
run from, not a fixed one, so two checkouts of this repo can run the suite at
the same time without landing on the same server. It reuses a server already
listening on that port (outside CI), and checks `dist/build-stamp.json` against
the copy the server hands back before running anything — if they disagree, the
run stops rather than reporting results for someone else's build.

Set `PLAYWRIGHT_PREVIEW_PORT` to move a run off its derived port.

## Deployment

The site is automatically deployed to GitHub Pages on every push to `main` via GitHub Actions.

**Live:** https://pratik.pa.tel/

## Web analytics

The site loads [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/) — a
privacy-friendly, cookieless beacon (no consent banner required) — to measure pageviews and
referral sources (PRA-465).

The beacon is **off by default** and only loads when a site token is configured:

- **CI / production:** set the repo **variable** `CF_BEACON_TOKEN` (Settings → Secrets and
  variables → Actions → Variables) to the Cloudflare Web Analytics site token for `pratik.pa.tel`.
  The deploy workflow passes it to the build as `VITE_CF_BEACON_TOKEN`.
- **Local:** `VITE_CF_BEACON_TOKEN=<token> bun run dev`.

When the variable is unset the beacon is a no-op (no network request), so local dev and previews
stay clean. The token is public by design (it ships in the page source), so it lives in a repo
variable rather than a secret. Implementation: `src/lib/analytics.ts`.
