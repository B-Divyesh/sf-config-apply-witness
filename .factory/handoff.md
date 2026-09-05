# Apply Witness repair handoff

## Release status

**PASS.** The deployed implementation is `d56e3fd1714c49f85f9099688d998fcb5a5a3e04` on `main` and at <https://config-apply-witness.sociobot.in/>. The previous review/report head was `4d377ee771c864be971ac3aaeb46f573e11cb1e9`; this handoff is a later documentation-only commit and was not deployed as product runtime.

The product is a local-first Rust CLI for small platform teams. It compares declared Supabase auth settings with readback and produces applied, changed, or unknown receipts. It does not apply configuration.

## What changed

- Replaced lossy `f64` numeric equality with exact signed/unsigned integer comparisons. Large unequal integers, signed limits, safe integer/float cases, and out-of-range TOML input have regressions.
- Redacted `env(...)` substitutions even on non-secret paths.
- Added `apply-witness demo`, which copies bundled examples to a new temporary directory, runs the normal offline witness, writes an owner-only receipt, and prints its location.
- Forced license-cache overwrites to mode `0600` on Unix. Batch now accepts a fresh valid cache when no environment token is supplied, so its recovery guidance works.
- Added a direct `/demo/` sandbox with populated applied/changed/unknown output, persistent **Demo — sample data, nothing is saved** label, Reset demo, Start for real, and separate `demo:config-apply-witness:` browser storage.
- Added `.factory/claims.json` with 20 outcome-based claim tests, `.factory/demo.md`, `.factory/copy-audit.md`, and the catalog description.
- Rewrote first-screen copy around the job, audience, and sample action. Added the CLI terminal recording, accessible route metadata, social image, apple-touch icon, CSP, sitemap demo entry, common header/footer, and a designed HTTP 404 route.

## Review finding disposition

| Finding | Disposition |
| --- | --- |
| F1 large integers falsely applied | Fixed and covered by library, CLI, and declared claim regression checks. |
| F2 public claims untested | Fixed: 20 declared claim commands pass. |
| F3 missing web/CLI demos | Fixed: `/demo/` and `apply-witness demo` use shipped samples. |
| F4 unsafe license-cache overwrite | Fixed: forced `0600` overwrite is tested from an existing `0644` cache. |
| F5 unclear first screen/copy audit | Fixed: job, audience, and sample action are above the fold; copy audit is present. |
| F6 routes, metadata, CSP, footer, 404 | Fixed: live `/demo`, legal pages, metadata, headers, and an intentional 404 all verify. |
| F7 batch recovery cannot work | Fixed: a fresh valid local cache unlocks batch. |
| F8 environment substitution redaction | Fixed and tested in CLI output. |
| Earlier receipt permissions, service-worker privacy, response policy, mobile targets, Cargo packaging, README language | Remain fixed and were rechecked. |

## Verification

From the documented clean setup:

- `npm ci` — pass, 0 audited vulnerabilities.
- `npm test` — pass: 15 Rust unit/integration tests, 9 Vitest tests, and 52 Playwright desktop/mobile checks.
- `npm run test:claims` — pass: all 20 declared claim tests. Each command in `.factory/claims.json` was also executed individually from the clean committed tree.
- `npm run lint` — pass: rustfmt, Clippy with warnings denied, and strict TypeScript.
- `npm run build` — pass: `dist/site/` and `dist/bin/apply-witness-linux-amd64`.
- `cargo test --doc`, `cargo package --locked`, and `npm pack --dry-run --json` — pass. The crate package contains 12 intended files.
- `npm audit --audit-level=low` and `npm audit --omit=dev --audit-level=low` — pass, 0 vulnerabilities.
- Clean package consumer: installed the packaged crate into a new prefix. `apply-witness 0.1.0` and `apply-witness demo --json` ran successfully, returning 6 applied and 1 unknown bundled-sample fields with a temporary receipt path.

Live deployment checks after the final deployment:

- Local production `index.html`, service worker, CSS, JavaScript, hero image, and CLI recording hashes match HTTPS responses.
- Factory URL verification: HTTP 200, 751 ms load, no console errors, title/lang/one h1/main/alt/button checks pass.
- Fresh desktop and 390 px phone contexts both show: job **Verify Supabase config after apply**; audience **small platform teams**; first action **Try it with sample data**.
- The one-click sample opens with three populated rows, shows the persistent demo label, reports invalid input clearly, resets correctly, clears demo storage on exit, makes no cross-origin request, and works offline after the first visit.
- Live Playwright axe scans found 0 serious or critical violations on home, demo, privacy, terms, and the 404 page. Keyboard, focus, reduced motion, and mobile target checks pass.
- `/missing-check-live` returns HTTP 404 and the designed `Page not found — Apply Witness` document. `/demo/`, `/privacy/`, and `/terms/` return 200 with correct route titles.
- HTTPS serves CSP, `X-Frame-Options: DENY`, `Permissions-Policy`, and expected cache headers. The service worker is `no-cache`; hashed CSS is immutable.
- Checkout endpoint returned a hosted-checkout redirect. No payment was attempted.
- Lighthouse mobile: Performance 98, Accessibility 100, Best Practices 100, SEO 100; LCP 1.96 s, CLS 0, transfer 225,076 bytes.

## Known limitations and next steps

- No real Supabase account, paid transaction, or refund was used. Those remain external dependencies; controlled local endpoint tests cover the request and license behaviors without credentials.
- The standalone `@axe-core/cli` could not start its Selenium browser in this container, even with Playwright’s executable supplied. The installed Playwright axe integration completed the equivalent live audits with zero serious/critical violations.
- Lighthouse emitted a browser-tab shutdown warning after producing a valid JSON report and scores. The report values above are recorded; the product URL smoke and live Playwright runs had no console errors.
- Registry publishing is intentionally left to the factory. Ready-to-publish artifacts were verified but not published.
