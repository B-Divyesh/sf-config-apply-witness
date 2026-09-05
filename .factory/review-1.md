# Review whether Apply Witness verifies applied configuration

## Verdict

**FAIL — 8 findings, including 3 high-severity findings, and 20 untested public claims.**

- Work order: `config-apply-witness-review-1`
- Reviewed: 2026-09-05 UTC
- Live URL: <https://config-apply-witness.sociobot.in/>
- Implementation candidate: `a453b1641328f9eb2df7609e1eec0b9e9b0f872a`
- Later test-only commit: `3a56baf047e00bdc4a63cec38e0f6f968cdc64a5`
- Documentation commit reviewed: `7c682bbacf4e4b8cdf03df05ccb79f3b6e5fffc9`

The live HTML, JavaScript, CSS, service worker, image, privacy page, and terms page match a local production build byte for byte. The last runtime change is `a453b16`; the two later commits change tests or reports, not the shipped runtime.

The CLI works for ordinary applied, changed, unknown, invalid, and recovery cases. It fails a numeric boundary case by reporting two different integers as applied. The required sample sandbox and claim registry are also absent. The product cannot pass this review.

## First screen before scrolling

- Job shown: compare declared Supabase auth fields with provider readback.
- Audience shown: none. The page does not name the small teams described in the brief.
- First primary action: **Install the CLI**.
- Sample action: **Run a local demo** is secondary. The required **Try it with sample data** action is absent.

The heading is “Success is a claim. Readback is proof.” It does not name the job in plain words and uses the proof-press metaphor as product copy.

## Findings

### F1 — High — different large integers can be reported as applied

The numeric comparison converts both JSON numbers to `f64`. The installed package compared declared `9007199254740992` with readback `9007199254740993`, returned exit `0`, and emitted:

```json
{"conclusion":"applied","summary":{"applied":1,"changed":0,"unknown":0,"total":1}}
```

The receipt still shows the two different integer values. This is a false-success result and directly breaks the researched success measure.

Required change: compare integers without floating-point conversion. Add boundary tests above `2^53`, signed limits, integer/float cases, and rejected out-of-range values.

### F2 — High — all 20 public claims lack required claim commands

`.factory/claims.json` does not exist. No test is tagged `@claim:*`. Therefore every public claim is untested under the claims contract, even where this review found useful ad-hoc evidence. The consolidated claim inventory below contains 20 distinct promises after repeated wording was de-duplicated.

Required change: create `.factory/claims.json`, give every claim exactly one sandbox test command, tag each test, and remove or correct claims that cannot be proved.

### F3 — High — the required sample sandbox does not exist

The live page and installed CLI do not implement the required demo entry point:

- There is no **Try it with sample data** action.
- One click on **Run a local demo** only scrolls to prefilled inputs. The receipt remains empty until a second action.
- There is no persistent **Demo — sample data, nothing is saved** label.
- There is no **Reset demo** or **Start for real** action.
- `/demo` serves the normal home page with the home title.
- The CLI has no `demo` command or `--demo` option.
- The landing page has no recording of the installed binary.
- `.factory/demo.md` is absent.

The browser sample does not write local or session storage and makes no cross-origin request, so it did not touch real data during review. That does not replace the missing sandbox contract.

Required change: add a direct `/demo` mode and CLI demo command using the shipped examples, show populated output after one click, keep a persistent sample label, and provide reset and exit actions.

### F4 — Medium — an overwritten license cache can remain readable by other users

This finding from verification 2 remains open. In a clean consumer environment, the packaged CLI successfully verified a controlled license response but left a pre-existing cache file at mode `0644`:

```text
license verify exit=0
overwritten cache mode=644
```

The privacy page promises owner-only permissions. The file contains the paid bearer token and verdict.

Required change: force mode `0600` after opening an existing cache file and add a regression that starts with mode `0644`.

### F5 — Medium — the first screen and section headings do not meet the plain-words contract

The first screen does not name the audience and does not make the sample the primary action. The main heading names an argument, not the job. Several headings use product metaphor instead of describing the section, including “Live proof desk,” “Receipt press is ready,” “Put proof in the pipeline,” and “Batch the proof, not the risk.” `.factory/copy-audit.md` is absent.

Required change: use a job title such as “Verify Supabase config after apply,” name small platform teams in the next sentence, make the sample action primary, replace metaphor headings, and add the required copy audit.

### F6 — Medium — required routes, metadata, response policy, and footer structure are incomplete

- An unknown route returns HTTP `200` with the home page. There is no designed 404 document or 404 response override.
- `/demo` is not a distinct page, has the home title, and is missing from the sitemap.
- Canonical, Open Graph, Twitter card, and apple-touch metadata are absent.
- No Content-Security-Policy response header is configured or served.
- The standard footer text **Built by Param Factory** and a build identifier are absent. Legal-page headers and footers also omit the standard navigation content.

A deliberate HTTP 404 would be expected. The defect here is that unknown paths silently become the home page with status 200.

Required change: add the required route documents, route-specific titles, metadata, CSP, sitemap entry, and common header/footer structure.

### F7 — Low — batch recommends a recovery action that cannot unlock it

This finding from verification 2 remains open. After a successful `license verify`, running `batch` without `APPLY_WITNESS_LICENSE` exits `1` before reading the cache and says to run `license verify` again. Repeating that action cannot make `batch` work.

Required change: either allow `batch` to use the valid cached token or remove that recovery instruction and name the required environment variable only.

### F8 — Low — the environment-substitution redaction claim is false as written

README says, “Environment substitutions and secret-like paths are redacted in all output.” The installed CLI emitted the declared value `env(REVIEW_PRIVATE_URL)` for `auth.site_url` when readback omitted that field. The field was unknown but not redacted.

Required change: redact environment-substitution expressions independently of the field name, or narrow the public claim to the behavior actually implemented.

## Public claim inventory

No row has a declared claim command because `.factory/claims.json` is missing. Repeated statements across the home page, README, privacy page, terms page, help, and product UI are counted once.

| ID | Consolidated public claim | Review evidence | Contract status |
| --- | --- | --- | --- |
| C01 | Declared Supabase fields are compared and non-applied fields never pass | **False** at the large-integer boundary | Untested |
| C02 | Applied, changed, and unknown use audited mappings and documented normalization | Ordinary cases pass; transformations are not documented by `schema` | Untested |
| C03 | Live verification uses read-only Supabase Management API readback | Controlled request used one GET | Untested |
| C04 | Provider tokens stay in the environment and are not stored, printed, or put in receipts | No leak found in tested paths | Untested |
| C05 | Secret-like fields and environment substitutions are redacted in all output | **False** for an environment-substitution value on a non-secret path | Untested |
| C06 | The CLI and site have no telemetry, behavioral analytics, or advertising cookies | No analytics request or cookie observed | Untested |
| C07 | The browser demo runs locally and nothing leaves the page | No cross-origin request during the sample flow | Untested |
| C08 | Offline fixture mode makes no provider request | File-readback cases passed | Untested |
| C09 | The site shell and local witness work offline after loading | Offline reload and receipt passed | Untested |
| C10 | Exit codes are 0 applied, 2 policy failure, and 1 operational failure; JSON and diagnostics use separate streams | Tested cases matched | Untested |
| C11 | Receipts contain the input hash, timestamp, provider identity, summary, redacted fields, and export content | Tested receipt matched stdout and independent hash | Untested |
| C12 | Receipt files use owner-only permissions | Existing `0644` receipt was changed to `0600` | Untested |
| C13 | One binary needs no daemon and installs with Rust 1.85 or newer | Packaged binary installed and ran on Rust 1.98 | Untested |
| C14 | Single-project verification, export, redaction, accessibility, and safety remain free | Free flow ran; the compound promise has no claim test | Untested |
| C15 | The paid kit adds batch manifests and compact CI summaries | Controlled cached-license batch passed | Untested |
| C16 | License validation uses only Sociobot and caches a verdict for one day | Controlled verify and cache reuse passed | Untested |
| C17 | The website stores license data in local storage only after supply and removes it when cleared | Invalid return flow used two documented keys; no cache URL remained | Untested |
| C18 | The CLI license cache has owner-only permissions and can be removed at the documented path | **False** when overwriting an existing file | Untested |
| C19 | The Team Receipt Kit costs $29 once and can be restored across the buyer’s machines | Checkout redirects; no paid transaction was made | Untested |
| C20 | Hosted checkout keeps card data away from the site and refunds revoke a license | Checkout host observed; payment and revocation were not exercised | Untested |

**Untested claim count: 20.** Manual evidence does not substitute for the required per-claim commands.

## Earlier finding disposition

| Earlier finding | Current disposition and proof |
| --- | --- |
| Checkout unavailable | Fixed. The product checkout returns `303` to the hosted checkout. No purchase was placed. |
| Existing receipt remains `0644` | Fixed. The packaged CLI changed an existing receipt to `0600`; file content matched stdout. |
| Service worker caches license URLs | Fixed. Live return flow left no Cache Storage URL containing the license query. |
| Production ignores response and cache policy | Fixed. Hashed assets and hero are immutable, `sw.js` is `no-cache`, and frame, permissions, referrer, nosniff, and HSTS headers are present. |
| Mobile targets below 44 px | Fixed. No visible target below 44×44 CSS px was found at 390×844. |
| Cargo package includes npm dependencies or needs `--allow-dirty` | Fixed. `cargo package --locked` passed with 12 intended files. |
| README names Go instead of Rust | Fixed. Current development instructions use Cargo and Rust. |
| Existing license cache remains `0644` | **Open.** Reproduced as F4. |
| Batch recovery message cannot recover | **Open.** Reproduced as F7. |

## Clean-checkout commands

Environment: Node `22.23.2`, npm `10.9.8`, rustc/cargo `1.98.0`, Playwright `1.58.2`, Chromium `145.0.7632.6`.

| Command | Result |
| --- | --- |
| `npm ci` | Pass; 59 packages, 0 vulnerabilities |
| `npm test` | Pass; 7 Rust, 8 Vitest, and 14 Playwright cases |
| `npm run lint` | Pass; rustfmt, Clippy with warnings denied, strict TypeScript |
| `cargo test --doc` | Pass; 1 doctest |
| `npm audit --audit-level=low` | Pass; 0 vulnerabilities |
| `npm audit --omit=dev --audit-level=low` | Pass; 0 vulnerabilities |
| `npm run build` | Pass; produced `dist/site/` and `dist/bin/` |
| `cargo package --locked` | Pass; 12 files, 83.9 KiB unpacked, 23.6 KiB compressed |
| `npm pack --dry-run --json` | Pass; 19 files, 234,288 bytes compressed |
| Claim commands from `.factory/claims.json` | **Missing; no file and no commands** |

## Installed CLI review

The packaged crate was installed into a clean temporary prefix. The installed binary was 4,021,808 bytes and reported version `0.1.0`. Root help, adapter listing, schema listing, and the following paths were exercised.

| Case | Exit | Result |
| --- | ---: | --- |
| Trimmed string, zero integer, inverted booleans, reordered URL set | 0 | 5 applied |
| Missing readback field | 2 | Unknown |
| Wrong provider boolean type | 2 | Unknown |
| No declared auth fields | 2 | Unknown |
| Unsupported provider | 1 | Clear adapter error |
| Missing config | 1 | Clear file error |
| Missing live credentials | 1 | Names the required environment variable |
| Malformed TOML | 1 | Line and column diagnostic |
| Malformed JSON | 1 | JSON diagnostic |
| Secret-like unknown field | 2 | Value absent from stdout and stderr |
| Existing receipt at `0644` | 2 | Changed to `0600`; hash and stdout matched |
| Controlled live GET | 0 | Correct path, bearer scheme, JSON accept header, and user agent |
| Controlled provider 401 | 1 | Clear status and provider message; no token printed |
| Cached paid batch with service unavailable | 0 | One applied result |
| Large unequal integers | **0** | **Incorrectly applied; F1** |

The product has no owned backend, account tenant, or SQLite state. Backend tenant-isolation, restart-persistence, health, and 429 checks are not applicable. Provider and billing requests were checked through controlled or public read-only endpoints only.

## Live desktop and phone review

Fresh Chromium contexts at 1440×1000 and 390×844 showed:

- One `h1`, one `main`, `lang="en"`, meaningful image alt text, labels, ordered headings, and visible focus.
- Skip link first in tab order; Space ran the witness; Enter opened restore and moved focus to the token field.
- No horizontal overflow and no visible target smaller than 44×44 CSS px.
- Zero serious or critical axe findings on home, privacy, terms, `/demo`, and the unknown route.
- No console errors, page errors, or failed requests on the normal flow.
- Reduced motion changed the hero animation to `0.01ms` and smooth scrolling to `auto`.
- A 720 px viewport used as a 200% desktop reflow check had no horizontal overflow and kept demo and purchase actions available.
- Normal sample output contained applied, changed, and unknown rows. Empty and malformed input produced clear errors, followed by successful recovery.
- Fresh load had no cookies or browser storage and contacted only the product origin.
- A supplied invalid license was removed from the URL, saved in the two documented local-storage keys, checked only against the Sociobot API, and excluded from Cache Storage.
- The active service worker had no waiting update. Offline reload displayed the offline state and still produced a receipt.
- Product and legal links returned `200`; checkout returned `303`; the source link returned `200`.

The factory URL check passed in 844 ms with zero console errors. Lighthouse 13.4.1 mobile scores were Performance 99, Accessibility 100, Best Practices 100, and SEO 100. FCP was 1.1 s, LCP 2.0 s, TBT 0 ms, CLS 0, and transfer 219 KiB. Built initial assets were 5,885 bytes JavaScript, 11,700 bytes CSS, 213,542 bytes hero WebP, and no webfont.

## Release decision

**FAIL.** Acceptance requires all eight findings to be resolved and all 20 public claims to have passing declared claim commands. A successful build and strong Lighthouse scores do not override the false applied result, missing sample sandbox, missing claim registry, or unresolved license-cache exposure.
