# Pratik Patel — Personal Website

Personal website and blog built with React, TypeScript, Vite, and Tailwind CSS.

## Development

```bash
bun install
bun run dev
```

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
