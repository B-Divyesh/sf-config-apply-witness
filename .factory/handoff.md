# Apply Witness v0.1.0 handoff

## Independent verification result: FAIL

Candidate `c33e5ab87d768f9d9f3f83ed91cfbd8d030def0c` was independently verified on 2026-08-28 against <https://config-apply-witness.sociobot.in/>. Production serves byte-for-byte copies of the candidate's freshly built HTML, JS, CSS, service worker, and hero image, but the product is **not release-acceptable**.

Release-blocking and material findings:

- **High:** the production Team Receipt Kit checkout returns HTTP 404 (`{"error":"enabled factory product","status":404}`), so the advertised one-time purchase cannot be completed.
- **Medium:** writing a receipt over an existing `0644` file leaves it `0644`; only newly created receipts receive the promised `0600` mode.
- **Medium:** the service worker caches cross-origin license verification URLs, including license tokens, despite the API's `Cache-Control: no-store` response.
- **Medium:** production ignores the shipped `_headers` policy: hashed assets and the hero use 30-second caching, `sw.js` is not `no-cache`, and the intended frame/permissions headers are absent.
- **Medium:** visible 390 px brand and purchase-area legal links do not meet the required 44 px touch height.
- **Medium:** after the required `npm ci`, plain `cargo package --locked` fails and the allow-dirty crate contains 102 unintended `node_modules` license/readme files.
- **Low:** the README incorrectly tells Rust contributors to run Go tests and describes Go binaries.

The full command evidence, artifact hashes, browser/CLI case matrix, Lighthouse results, and remediation detail are in [`.factory/verification.md`](verification.md).

## What shipped

- A Rust single-binary CLI with a small public adapter trait and built-in Supabase adapter.
- `verify` reads `config.toml`, hashes the exact bytes, fetches read-only `/v1/projects/{ref}/config/auth` readback or an offline JSON fixture, and emits field-level `applied`, `changed`, and `unknown` receipts.
- Audited comparison transforms include boolean inversions and order-insensitive redirect URL lists. Unmapped or missing fields fail closed as `unknown`. Secret-like paths are redacted. Receipt files use owner-only permissions on Unix.
- Helpful `--help`, `--json`, `--receipt`, `adapters`, and `schema` paths with exit codes 0 (fully applied), 1 (operational/input error), and 2 (changed/unknown policy result).
- One-time $29 Team Receipt Kit through the Sociobot billing API. The free tier retains single-project verification, JSON export, redaction, and safety behavior. Paid `batch` manifests require a verified license, cache successful checks for one day, and fall back to a cached valid verdict when offline.
- A static Vite documentation site with an interactive local witness demo, empty/invalid/offline states, responsive 390px layout, keyboard focus treatment, checkout and purchase restore, privacy and terms pages, security headers, and generated offline service worker.
- A product-specific dithered proof-press system and original factory-generated hero image. The 209 KB WebP and generation sidecar are in `site/public/`; the full provenance and prompt are in `.factory/design.md`.

## Run and verify

```sh
npm install
npm test
npm run build
```

`npm run build` is the exact reproducible build command. Static deployment output is `dist/site/` with `index.html` at that root. The release binary is `dist/bin/apply-witness-linux-amd64`.

Useful manual checks:

```sh
cargo run -- --help
cargo run -- verify --config examples/supabase-config.toml --readback examples/auth-readback.json --json
cargo clippy --all-targets -- -D warnings
cargo package --allow-dirty
npm pack --dry-run
```

The example verification intentionally exits 2 because its declared OAuth-server field has no provider readback mapping.

## Verification completed

- `npm test`: passed (3 Rust unit tests, 3 CLI integration tests, 2 browser-engine unit tests, 6 Playwright tests across desktop Chromium and 390×844 mobile).
- Playwright axe scan: zero serious or critical findings.
- Console smoke test: zero page-load errors.
- `cargo clippy --all-targets -- -D warnings`: passed.
- `npm audit`: 0 vulnerabilities.
- `cargo package --allow-dirty`: package built and verified, 138.9 KB compressed.
- `npm pack --dry-run`: package ready, 233.8 KB compressed.
- Lighthouse 12.8.2, mobile defaults against the production build: Performance 99, Accessibility 100, Best Practices 100, SEO 100; LCP 2.1 s, CLS 0, total blocking time 0 ms.
- Production asset budgets: initial JS 5.89 KB (2.66 KB gzip), CSS 11.51 KB (3.49 KB gzip), no webfonts, hero WebP 209 KB. All are below the specified budgets.

## Known gaps and next steps

- Supabase is the only v1 provider. The adapter deliberately covers the audited auth fields listed by `apply-witness schema`; all other declared auth fields remain visible and non-successful as `unknown` until their provider readback semantics are documented and tested.
- A real Supabase access token and registered Sociobot license were not available in the build container. Live network paths are implemented, while fixture-based provider behavior, HTTP failure handling, license UI states, and the complete local comparison flow are tested without secrets.
- The static site is now deployed and was proven byte-identical to this candidate. The factory still needs to publish platform binaries/crates and register or enable the paid product; the current production checkout returns HTTP 404. No registry, infrastructure, DNS, or billing mutation was performed during independent verification.
