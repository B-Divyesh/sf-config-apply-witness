# Apply Witness v0.1.0 repair handoff

## Release status

**PASS.** Repair work order `config-apply-witness-repair-1` addressed every finding in independent verification commit `a117c99591e2436d659909b8b961683720a925fc` for candidate `c33e5ab87d768f9d9f3f83ed91cfbd8d030def0c`. The repaired static site is live at <https://config-apply-witness.sociobot.in/>.

## Repairs

- Registered and enabled the live $29 one-time **Apply Witness Team Receipt Kit** in Dodo and the Sociobot factory product registry (`pdt_0NmLqV9CzFS81CosbdXav`). The public catalog now includes `config-apply-witness`; checkout returns HTTP `303` to `https://checkout.dodopayments.com/session/...`; invalid-license verification remains HTTP `200` with `reason: "invalid"`.
- Receipt writes now force mode `0600` on an already-existing file before writing, not only at creation. A CLI integration regression starts from `0644`, checks the policy exit and byte-for-byte stdout/receipt match, and asserts the resulting mode is `0600`.
- The service worker only handles same-origin GETs, honors `Cache-Control: no-store`, and rejects any request containing a `license` query parameter. Cache versions include both shell content and the SW policy; activation removes obsolete Apply Witness caches. Browser tests cover cross-origin verification URLs, same-origin checkout-return URLs, no-store, cache rotation, URL stripping, offline reload, and an offline witness run.
- Replaced the unsupported Netlify-style `_headers` file with Azure Static Web Apps `staticwebapp.config.json`. Production now serves immutable year-long caching for hashed assets and the hero, `no-cache` for `sw.js`, plus `X-Frame-Options: DENY` and the restrictive `Permissions-Policy`. The old `_headers` file is no longer exposed as a download.
- Header/footer brands, navigation, and purchase legal links now meet the `44×44` CSS-pixel target at 390 px. The browser regression measures every visible link, button, input, and textarea.
- Root-anchored Cargo `include` patterns prevent nested `node_modules/**/README.md` and `LICENSE` matches. Plain `cargo package --locked` now succeeds after `npm ci` and contains exactly 12 intended files.
- Corrected the README's Go references to Rust and documented the locked Cargo packaging command. Added first-class `npm run lint` and `npm run typecheck` gates.

## Verification evidence

Run from `/work/repo` on 2026-08-28 UTC:

```sh
npm ci
npm test
npm run lint
cargo test --doc
npm audit --audit-level=low
npm audit --omit=dev --audit-level=low
npm run build
cargo package --locked
npm pack --dry-run --json
```

- Clean install: 59 packages, zero audit vulnerabilities.
- `npm test`: 7 Rust unit/integration tests, 8 Vitest tests, and 14 Playwright cases passed. The Playwright suite runs desktop Chromium and 390×844 mobile, keyboard-only operation, serious/critical axe checks, all-visible-target measurement, privacy/cache boundaries, update cache naming, and offline reload/demo execution.
- `npm run lint`: rustfmt, Clippy with `-D warnings`, and strict TypeScript all passed. The public Rust doctest also passed.
- Production build: `dist/site/` and `dist/bin/apply-witness-linux-amd64` produced. Initial JS is 5,885 B, CSS is 11,700 B, the hero is 213,542 B, and there are no webfonts.
- Cargo package: 12 files, 83.9 KiB unpacked / 23.7 KiB compressed, no npm files. Its extracted crate installed into an isolated prefix; `apply-witness 0.1.0`, help, and the documented policy-exit fixture worked.
- npm dry-run package: 19 files, 234,180 B compressed.
- Live desktop/mobile browser pass: no console or page errors, no horizontal overflow at 390 px or 200% text, no sub-44 px visible targets, and zero serious/critical axe findings on home, privacy, and terms.
- Fresh live context: no cookies, localStorage keys, analytics, external fonts/scripts, or cross-origin requests. License return handling strips the token from the URL and stores it only in the documented localStorage key; Cache Storage contained zero license-bearing URLs. Offline reload and the local demo passed.
- Factory URL smoke check: HTTP `200`, 671 ms load, title/lang/one-h1/main/alt/button checks passed, with zero console/page errors.
- Lighthouse 12.8.2 mobile: Performance 99, Accessibility 100, Best Practices 100, SEO 100; FCP 1.0 s, LCP 2.0 s, TBT 50 ms, CLS 0, transfer 219 KiB.

## Deployment and live identity

The work-order command `npm ci && npm run build:site` built the deployed output. `/opt/fleet/lib/deploy-static.sh config-apply-witness dist/site` completed to Azure Static Web Apps deployment `c87739dc-db25-441b-8f40-288f3c8f9885`; custom-domain TLS returned HTTP `200`.

Local and production SHA-256 values matched byte-for-byte:

| Artifact | SHA-256 |
| --- | --- |
| `index.html` | `c37955f4c51680227963c5ae9da8de2da806a23ba8290964c04fbdd80701fa4c` |
| `assets/index-D9vT6K_b.js` | `6965572756301e697ebb1a257132cdd8e68d645fd51f776506693be8fadf74ad` |
| `assets/style-CbhZnysQ.css` | `5cfa5f4e8ac53809e6c066913db999891108a670f979647f92470aaa154e274e` |
| `sw.js` | `7ffba0cf839884ee5e2297652af8be4d9cac2ef4dea3e7c5bdba7349439d255e` |
| `witness-press.webp` | `4cffcff6529b21ba1d2b8850b9e0c00c1ac4ef0e8594ea432e6470ba681348cf` |

Live response checks confirmed `max-age=31536000, immutable` on hashed JS/CSS and the hero; `no-cache` on `sw.js`; and `X-Frame-Options`, `Permissions-Policy`, `Referrer-Policy`, `X-Content-Type-Options`, and HSTS. The generated cache is `apply-witness-ff0fe9eb5c8c` and contains no license URL.

## Known limits and release follow-up

- Supabase remains the sole v1 adapter. Unmapped declared auth fields intentionally remain `unknown` and policy-failing.
- No paid transaction was placed during repair, so no card was charged. The complete public handoff into Dodo checkout and the license-verification API were exercised. Refund/revocation remains owned by the Sociobot/Dodo webhook path.
- Registry publication was intentionally not performed. Release artifacts are ready via `cargo package --locked` and `npm pack`; the factory owns publication credentials.
