# Independent product verification 2 — FAIL

- **Candidate:** `3a56baf047e00bdc4a63cec38e0f6f968cdc64a5`
- **Branch / remote:** clean `main`; candidate matched `origin/main` before verification
- **Production URL:** <https://config-apply-witness.sociobot.in/>
- **Verified:** 2026-08-28 UTC
- **Work order:** `config-apply-witness-verify-2`
- **Result:** **FAIL**

The candidate fixes the defects from the first independent verification: the checkout is live, receipt overwrite permissions are repaired, service-worker privacy boundaries and cache rotation work, production consumes the Azure response policy, mobile targets meet the required size, Cargo packaging is clean, and the README/build gates are correct. The core free CLI also meets the brief's conservative success measure. Release acceptance still fails because an existing CLI license cache can retain unsafe permissions while containing the paid bearer token.

## Defects

### Medium — overwriting an existing license cache does not enforce owner-only permissions

The privacy page promises that the CLI stores the license token and verdict in the user's cache “with owner-only permissions.” A new cache file is correctly created as `0600`, but a pre-existing file keeps its earlier mode because `write_license_cache` uses creation mode without resetting existing permissions.

Fresh reproduction used the CLI installed from the packaged crate and a controlled Sociobot-compatible endpoint:

```text
create $XDG_CACHE_HOME/apply-witness/license.json; chmod 0644
apply-witness license verify --token qa-valid
exit=0
cache mode=644
cache={"token":"qa-valid","valid":true,"reason":"ok",...}
```

This exposes a reusable paid license token to other local users on a multi-user Unix system when a cache file already exists with permissive mode. The receipt overwrite path correctly forces `0600`; the equivalent protection and regression test are missing for the license cache.

### Low — the advertised batch recovery action does not unlock batch by itself

After a successful `apply-witness license verify --token qa-valid`, with a fresh valid daily cache, running `batch` without `APPLY_WITNESS_LICENSE` exits `1` before reading that cache:

```text
error: Team Receipt Kit is locked: set APPLY_WITNESS_LICENSE or run `apply-witness license verify`
```

The second suggested recovery action has already been completed and repeating it does not make `batch` work. The README's batch example correctly supplies the environment variable, so this is a misleading recovery path rather than a blocker to users who follow that example.

## Clean-checkout gates

Environment: Node `v22.23.2`, npm `10.9.8`, rustc `1.98.0`, cargo `1.98.0`, Playwright `1.58.2`, Chromium `145.0.7632.6`.

| Check | Fresh result |
| --- | --- |
| Initial repository state | clean at candidate; `origin/main` was the same SHA |
| `npm ci` | pass; 59 packages, 0 vulnerabilities |
| `npm test` | pass; 7 Rust unit/integration, 8 Vitest, 14 Playwright cases |
| `npm run lint` | pass; rustfmt, Clippy `-D warnings`, strict TypeScript |
| `cargo test --doc` | pass; 1 public API doctest |
| `npm audit --audit-level=low` | pass; 0 vulnerabilities |
| `npm audit --omit=dev --audit-level=low` | pass; 0 vulnerabilities |
| exact `npm run build` | pass; created `dist/site/` and `dist/bin/apply-witness-linux-amd64` |
| `cargo package --locked` | pass; 12 intended files, 83.9 KiB unpacked / 23.7 KiB compressed |
| `npm pack --dry-run --json` | pass; 19 files, 234,288 B compressed |

No additional repository lint/type scripts exist. The `npm test` browser matrix covers Chromium desktop and 390×844 mobile, serious/critical axe checks, keyboard flow, touch sizes, service-worker privacy, cache rotation, and offline reload.

## Packaged consumer and CLI evidence

The verified crate was installed from `target/package/apply-witness-0.1.0` into a clean temporary prefix. The resulting 4,021,808-byte binary reported `apply-witness 0.1.0`; root and `verify` help, adapter listing, and the 15-field Supabase schema were usable. A separate clean Rust consumer compiled against the packaged crate and exercised `verify_supabase`, `VerifyInput`, `Status`, `Receipt::successful`, and summary fields successfully.

| Installed CLI case | Exit | Evidence |
| --- | ---: | --- |
| Matching trimmed string, zero integer, inverted booleans, reordered redirect set | 0 | 5 applied, 0 changed, 0 unknown |
| Differing provider value | 2 | field and conclusion `changed` |
| Readback field absent | 2 | `unknown`, explicit absent-field reason |
| Provider boolean has wrong type | 2 | `unknown`, not green |
| No declared `[auth]` fields | 2 | synthetic `auth` unknown result |
| Malformed TOML | 1 | empty stdout; line/column parse diagnostic on stderr |
| Malformed JSON | 1 | empty stdout; parse diagnostic on stderr |
| Unsupported adapter | 1 | adapter-not-installed diagnostic |
| Missing config | 1 | actionable file diagnostic |
| Missing live credentials | 1 | names `SUPABASE_ACCESS_TOKEN` without leaking data |
| Unknown secret-like field | 2 | value absent from stdout/stderr; declared value is `[REDACTED]` |
| Existing receipt initially `0644` | 2 | reset to `0600`; receipt exactly matched JSON stdout |
| Receipt input hash | — | exactly matched independent `sha256sum` of the config bytes |
| 12 simultaneous independent verification processes | 0 each | all 12 produced valid applied receipts |
| Mixed three-job batch with fresh cached license | 2 | applied and changed receipts plus per-job missing-file error; relative paths resolved from manifest |
| Empty batch manifest | 1 | actionable `manifest has no jobs` diagnostic |
| Invalid license | 1 | classified `invalid`; newly created cache was `0600` |

A controlled provider server confirmed the precise read-only `GET /v1/projects/qa-project/config/auth`, `Authorization: Bearer …`, `Accept: application/json`, and `User-Agent: apply-witness/0.1.0`. Matching readback exited `0`; controlled `401` exited `1` with `Supabase readback returned 401: QA denied`, no token in diagnostics. The controlled license server was contacted once for a forced valid check; the fresh daily verdict was then reused by batch without network.

The seeded repository fixture exits `2` with 6 applied and 1 unknown. Across unit tests and independent ignored, absent, malformed-type, and unmapped cases, every non-applied field was non-successful, satisfying the brief's 100% conservative-classification measure.

## Deployment identity and response policy

The exact local production build and live deployment matched byte-for-byte:

| Artifact | SHA-256 | Match |
| --- | --- | --- |
| `index.html` | `c37955f4c51680227963c5ae9da8de2da806a23ba8290964c04fbdd80701fa4c` | yes |
| `assets/index-D9vT6K_b.js` | `6965572756301e697ebb1a257132cdd8e68d645fd51f776506693be8fadf74ad` | yes |
| `assets/style-CbhZnysQ.css` | `5cfa5f4e8ac53809e6c066913db999891108a670f979647f92470aaa154e274e` | yes |
| `sw.js` | `7ffba0cf839884ee5e2297652af8be4d9cac2ef4dea3e7c5bdba7349439d255e` | yes |
| `witness-press.webp` | `4cffcff6529b21ba1d2b8850b9e0c00c1ac4ef0e8594ea432e6470ba681348cf` | yes |
| `privacy/index.html` | `c1e47edbd6c3303b921c9c97ce4793af63f8f33169477dfacd718af8042007f8` | yes |
| `terms/index.html` | `56f1e959e13295e89eb2076572079f309295fd7bea8309d3a2fda2cadf6f0a3f` | yes |

HTTP redirects to HTTPS with `301`; HTTPS returns HTTP/2 `200`. Hashed JS/CSS and the hero return `Cache-Control: public, max-age=31536000, immutable`; `sw.js` returns `no-cache`; HTML uses 30-second revalidation. Responses include HSTS, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, and `Permissions-Policy: camera=(), microphone=(), geolocation=()`. The Azure control file is not publicly exposed (`404`).

The production buy URL returned `303` to a `checkout.dodopayments.com/session/...` hosted session. The invalid-license probe returned HTTP `200`, `Cache-Control: no-store`, and `{valid:false,reason:"invalid",expires_at:null}`; CORS preflight explicitly allowed the production origin. No purchase was placed and no card was charged.

## Live browser, accessibility, privacy, and offline evidence

Fresh Chromium contexts at 1440×1000 and 390×844 found:

- No console errors, page errors, failed online requests, or horizontal overflow.
- Nonempty title, `lang="en"`, exactly one `h1`, one `main`, meaningful image alt, labeled controls, and ordered landmarks/headings.
- Zero serious or critical axe findings on home, privacy, and terms in both viewports.
- Skip link was the first Tab stop and moved focus to `main`; keyboard Space ran the witness; restore-button Enter moved focus to its input. Focus was a visible 3 px red outline.
- Every visible link, button, input, and textarea was at least 44×44 CSS px, including the expanded restore form; adjacent interactive targets were at least 8 px apart.
- Normal demo output contained applied, changed, and unknown rows. Empty declaration and malformed JSON produced actionable announced errors, followed by successful recovery to an applied receipt.
- `prefers-reduced-motion: reduce` matched; the hero animation became `0.01ms` and smooth scrolling became `auto`.
- A 720 px viewport, approximating 200% desktop zoom/reflow, had no horizontal overflow and retained the witness and purchase actions.
- Fresh first load had no cookies, local/session storage, analytics, third-party font/script, or cross-origin requests. Source inspection found only the expected Supabase and Sociobot runtime endpoints.
- A checkout-return token was removed from the URL, stored only under the documented localStorage keys, and classified invalid by the real API. No Cache Storage URL contained `license=`.
- The active service worker was `/sw.js`; cache `apply-witness-ff0fe9eb5c8c` matched the candidate. An update check left no waiting/installing worker. Obsolete-cache deletion is covered by the passing release-policy test.
- Offline reload showed the offline state and the local witness still produced a receipt.

The factory URL smoke script passed in 648 ms with title/lang/one-h1/main/alt/button checks and zero console/page errors.

## Performance and budgets

Fresh Lighthouse 12.8.2 mobile run (exit `0`):

| Metric | Result |
| --- | ---: |
| Performance | 98 |
| Accessibility | 100 |
| Best practices | 100 |
| SEO | 100 |
| FCP | 1.1 s |
| LCP | 2.0 s |
| TBT | 110 ms |
| CLS | 0 |
| Total transfer | 219 KiB |

The built initial JS is 5,885 B, CSS is 11,700 B, the hero WebP is 213,542 B, and there are no webfonts. All explicit JS, CSS, font, hero, LCP, and CLS budgets pass. INP is not available from a synthetic no-user-input Lighthouse navigation; interactive browser checks completed without delay or errors.

## Acceptance decision

**FAIL.** The deployed candidate is authentic and the core post-apply witness works end to end, including conservative handling of every tested non-applied field. The live checkout and all prior deployment defects are repaired. Release acceptance requires forcing `0600` whenever the CLI overwrites its license cache and adding a regression for that path. The misleading batch recovery message should also be corrected. Registry publication remains intentionally out of scope for the verifier.
