# Independent product verification — FAIL

- **Candidate:** `c33e5ab87d768f9d9f3f83ed91cfbd8d030def0c`
- **Branch / remote:** `main`, `origin/main` at the candidate before verification
- **Production URL:** <https://config-apply-witness.sociobot.in/>
- **Verified:** 2026-08-28 UTC
- **Work order:** `config-apply-witness-verify-1`
- **Result:** **FAIL**

The free single-project witness performs its core conservative comparison job, the checked-in test and build gates pass, and production serves the candidate's exact static artifacts. The release nevertheless does not satisfy the full acceptance contract: the advertised purchase flow is unavailable, a receipt can retain unsafe pre-existing permissions, and production has additional privacy, response-policy, package, and mobile-target defects detailed below.

## Defects

### High — production purchase flow is unavailable

The visible “Buy the Team kit · $29” link points to the required Sociobot URL, but a fresh request to that exact URL returns an error instead of checkout:

```text
GET https://api.sociobot.in/api/v1/products/config-apply-witness/checkout
HTTP/2 404
{"error":"enabled factory product","status":404}
```

There is therefore no end-to-end way to buy the advertised one-time unlock. The verify endpoint itself is live (`200`, invalid probe classified as `{"valid":false,"reason":"invalid"}`) and its CORS preflight allows the production origin, so this is specifically a missing/disabled production product registration or checkout configuration.

### Medium — overwriting an existing receipt does not enforce owner-only permissions

The CLI promises mode `0600`, but `write_receipt` applies that mode only when creating a file. Reproduction with the packaged, clean-installed binary:

```text
create empty receipt path; chmod 0644 receipt.json
apply-witness verify ... --receipt receipt.json --json
exit=2 mode=644 bytes=1522
```

A newly created receipt was correctly `0600`, and its content matched stdout. An existing group/world-readable receipt remains `0644`, contrary to the README, privacy copy, and handoff guarantee. Receipts redact secret-like paths but still contain configuration, project identity, and provider readback values.

### Medium — the service worker persists license tokens in Cache Storage

With the production service worker activated, a same-page call to the real verification endpoint caused Cache Storage `apply-witness-v1` to contain:

```text
https://api.sociobot.in/api/v1/products/config-apply-witness/verify?license=qa-cache-probe-nonsecret
```

The API response says `Cache-Control: no-store`, but the service worker caches every successful GET, including cross-origin requests. This creates an undisclosed second persistent copy of the license token outside `localStorage`; clearing the documented localStorage key does not remove it. Cache only same-origin static GETs and honor `no-store`/sensitive API boundaries.

### Medium — production ignores the shipped response and caching policy

The built `_headers` file asks for one-year immutable caching on hashed assets and the hero, `no-cache` on the service worker, plus `X-Frame-Options: DENY` and a restrictive `Permissions-Policy`. Production instead serves HTML, hashed JS/CSS, the hero, and `sw.js` with the same:

```text
Cache-Control: public, must-revalidate, max-age=30
```

`X-Frame-Options` and `Permissions-Policy` are absent. The `_headers` control file is exposed as a public `application/octet-stream` download rather than consumed. HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, and `X-Content-Type-Options: nosniff` are present. This is a deployment adapter/configuration failure, not stale content.

### Medium — required 44 px touch targets are not met at 390 px

Automated bounding-box inspection on the live 390×844 layout found visible interactive targets below the attached 44×44 baseline, including the header/footer brand links at approximately `143×38` and the inline purchase-area legal links at approximately `55×15` and `39×15`. Keyboard focus remains visible and axe reports no serious/critical findings, but these touch targets fail the explicit mobile contract.

### Medium — the normal ready-to-publish Cargo package command fails after the required install

From the clean candidate, `npm ci` succeeds, but the documented publishing check then behaves as follows:

```text
cargo package --locked
error: 102 files in the working directory contain changes that were not yet committed into git
```

The files are ignored `node_modules/**/LICENSE` and `README.md` entries matched by the crate `include` patterns. `cargo package --list --allow-dirty` confirms 102 unintended `node_modules` members. `cargo package --locked --allow-dirty` does verify, and that extracted crate installs and runs from an isolated prefix, but the default release packaging path is not clean and includes unrelated npm dependency documents.

### Low — development instructions name the wrong implementation language

`README.md` tells contributors to run `go test ./...` and says `npm run build` compiles Go binaries. This product is Rust (`cargo test`, `cargo build`), so the documented development workflow is misleading.

## Candidate and deployment identity

The checkout began clean at the requested commit, which also matched `origin/main`. A locked install and exact `npm run build` were run before comparison. Production and local build hashes match byte-for-byte:

| Artifact | SHA-256 | Match |
| --- | --- | --- |
| `index.html` | `376193e484e074faee58c83dc8847907af6dc20a0dc9c71b3447dc01127d7220` | yes |
| `assets/index-Diypwjia.js` | `d2daba40c906e8e6d58f08e397a346efae69c6a30e6da9390e30d81d47856dae` | yes |
| `assets/style-E0Cd9gLg.css` | `a0a99335408ea3a75c58a1e07c572d4e836854716cea67f1f22c941928e4affd` | yes |
| `sw.js` | `adb7b2c568b787f18239e3141cc30f98c23dbbaabe2d05222b30f9e40255a5b7` | yes |
| `witness-press.webp` | `4cffcff6529b21ba1d2b8850b9e0c00c1ac4ef0e8594ea432e6470ba681348cf` | yes |

HTTP redirects to HTTPS (`301`); HTTPS is valid and returned HTTP/2 `200`.

## Repository gates

Environment: Node `v22.23.2`, npm `10.9.8`, rustc `1.98.0`, cargo `1.98.0`, Chromium `145.0.7632.6`.

| Check | Result |
| --- | --- |
| `npm ci` | pass; 59 packages, 0 audit vulnerabilities |
| `npm test` | pass; 3 Rust unit, 3 Rust CLI integration, 2 Vitest, 6 Playwright tests |
| `cargo test --doc` | pass; documented public API example |
| `cargo fmt --all -- --check` | pass |
| `cargo clippy --all-targets -- -D warnings` | pass |
| strict browser TS check via `npx tsc --noEmit ... --strict` | pass |
| `npm audit --audit-level=low` | pass; 0 vulnerabilities |
| exact `npm run build` | pass; `dist/site/` and `dist/bin/apply-witness-linux-amd64` produced |
| `npm pack --dry-run` | pass; 19 files, 233.8 KB compressed |
| `cargo package --locked` after clean install | **fail**, described above |
| `cargo package --locked --allow-dirty` | pass; 495.3 KiB / 138.9 KiB compressed, with unintended files |
| install packaged crate into isolated prefix | pass; `apply-witness 0.1.0` runs |

There is no repository-defined JS lint script. Strict Clippy and the manual strict TypeScript check cover the available typed sources.

## CLI end-to-end evidence

The isolated installed CLI was exercised, not only the workspace binary.

| Case | Exit | Result |
| --- | ---: | --- |
| matching string, zero boundary, inverted boolean, reordered redirect set | 0 | 4 applied, 0 changed, 0 unknown |
| differing readback | 2 | changed |
| field absent from readback | 2 | unknown |
| wrong provider boolean type | 2 | unknown |
| no declared `[auth]` fields | 2 | unknown |
| malformed TOML | 1 | actionable parse diagnostic on stderr |
| malformed JSON | 1 | actionable parse diagnostic on stderr |
| unsupported adapter | 1 | adapter-not-installed diagnostic |
| unknown secret-like field | 2 | unknown; test value absent from stdout/stderr |
| documented fixture | 2 | 6 applied, 1 unknown; ignored OAuth field is not green |

The SHA-256 in a generated receipt exactly matched `sha256sum` of the source config. JSON stayed on stdout and operational diagnostics on stderr. A controlled live-provider server confirmed the precise read-only path `/v1/projects/project-qa/config/auth`, bearer authorization, JSON accept header, `apply-witness/0.1.0` user agent, clean `401` handling, and no token in diagnostics.

The license/batch CLI was also tested against a controlled valid Sociobot-compatible endpoint: license verification exited 0, wrote a `0600` cache, a one-job relative-path batch reused the fresh daily verdict without network, and returned an applied JSON result with exit 0. The real checkout could not supply a legitimate license because of the high-severity defect.

## Browser, accessibility, privacy, and PWA evidence

- Desktop `1440×1000` and mobile `390×844`: no horizontal overflow; live demo reached applied, changed, unknown, empty, malformed, and recovery states.
- Keyboard-only: skip link is first, controls follow a logical order, Enter/Space operation works, no trap, and focused elements show a 3 px red outline.
- Semantics: nonempty title, `lang="en"`, exactly one `h1`, one `main`, labeled controls, and no missing image alt.
- Axe Playwright scan after interaction: 0 serious/critical findings on desktop, mobile, privacy, and terms pages.
- Factory `/opt/fleet/lib/verify-url.sh`: pass; HTTP 200, load 677 ms, 0 console/page errors, title/lang/main/alt/button checks pass.
- Reduced motion: media query matched; animation and transitions reduced to `0.01ms`, smooth scrolling disabled.
- 200% text-size smoke at 390 px: no horizontal overflow; primary demo and buy controls remain rendered.
- Fresh initial page: no cookies, no localStorage keys, and no cross-origin requests. No external fonts/scripts or analytics were observed.
- License return handling: token removed from visible URL, stored under `sb_license:config-apply-witness`, and invalid mocked verification produced a quiet locked state.
- PWA: service worker installed and controlled the page; offline reload succeeded, showed the offline notice, and the local demo still produced a receipt. The cache name is statically `apply-witness-v1`, so obsolete hashed entries are not pruned across source updates.

## Performance and budgets

Fresh Lighthouse 12.8.2 mobile defaults against production:

| Metric | Result |
| --- | ---: |
| Performance | 99 |
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 100 |
| FCP | 0.9 s |
| LCP | 2.0 s |
| TBT | 80 ms |
| CLS | 0 |
| Total transfer | 219 KiB |

Production output sizes are 5,891 B JS, 11,529 B CSS, 213,542 B hero WebP, and no webfont. All explicit JS, CSS, font, hero, LCP, and CLS budgets pass. The immutable caching requirement fails as described above.

## Acceptance decision

**FAIL.** The conservative free CLI succeeds at the brief's core detection measure and all seeded/non-happy comparison cases remain non-successful. Release acceptance still requires, at minimum, a working registered checkout, forced permissions on replaced receipt files, same-origin/static-only service-worker caching, deployment support for the intended headers/cache rules, 44 px mobile targets, and a clean Cargo package manifest. The README language correction is non-blocking but should ship with those fixes.
