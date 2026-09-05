# Verify Supabase configuration after apply — verification 3

## Verdict

**FAIL — 1 low-severity finding, 0 untested declared claims.**

- Work order: `config-apply-witness-verify-3`
- Live URL: <https://config-apply-witness.sociobot.in>
- Implementation reviewed: `d56e3fd1714c49f85f9099688d998fcb5a5a3e04`
- Documentation head: `d5400d220e1ecbebe898dd0d0f20707fc8767580`
- Verified: 2026-09-05 UTC

`d5400d2` changes only `CHANGELOG.md` and the earlier handoff. The live HTML,
CSS, JavaScript, service worker, hero image, and CLI recording all match a
fresh build of `d56e3fd` byte for byte. A successful deployment wrapper is not
the issue: the live product works in its main flow, but the legal-page email
links do not meet the required 44 px touch-target baseline. The acceptance
rule requires zero findings at every severity, so this cannot be a PASS.

## Finding

### F1 — Low — legal-page email links are too small for touch

At a fresh 390 × 844 phone viewport, the `mailto:` link on `/privacy/`
(`privacy@sociobot.in`) and the one on `/terms/` (`support@sociobot.in`) each
have a measured box of 182.44 × 18 CSS px. They are interactive links, but
their height is below the attached accessibility requirement of 44 px.

The route otherwise has no horizontal overflow, and the links remain usable
with keyboard and a pointer. This is still a mobile accessibility defect,
because touch users receive an 18 px target. The same root cause affects both
legal-page contact links.

Repair: give inline contact links a 44 px minimum interactive target without
making their text measure misleading (for example, an inline-flex or block
contact control with adequate vertical padding), and add a desktop/mobile
geometry regression that includes `mailto:` links on `/privacy/` and `/terms/`.

## Declared claims

All 20 commands declared in `.factory/claims.json` were run from the clean
checkout after `npm ci`. Each exact `npm run test:claims -- --grep
@claim:<id>` command passed. The consolidated command also passed all 20
tests in 11.2 seconds.

| Claim ID | Result |
| --- | --- |
| conservative-classification | Pass |
| audited-mappings | Pass |
| read-only-live-readback | Pass |
| provider-token-privacy | Pass |
| redaction | Pass |
| no-telemetry | Pass |
| browser-demo-local | Pass |
| fixture-no-provider-request | Pass |
| offline-demo-reload | Pass |
| exit-codes | Pass |
| receipt-content | Pass |
| receipt-permissions | Pass |
| cli-demo | Pass |
| free-single-project | Pass |
| batch-manifests | Pass |
| daily-license-cache | Pass |
| website-license-storage | Pass |
| license-cache-permissions | Pass |
| price-and-restore | Pass |
| revoked-license | Pass |

**Untested declared claims: 0.** The public claim copy was also checked against
this registry; its conservative outcomes, mapping, read-only behavior,
redaction, demo isolation, offline support, receipt data, permissions, free
and paid behavior, price, restoration, and revocation statements have matching
claim coverage.

## Local and packaged checks

The documented clean setup completed successfully:

- `npm ci` — pass; 0 audit findings.
- `npm test` — pass; Rust unit/integration checks, 9 Vitest tests, and 52
  Playwright checks across desktop and phone.
- `npm run test:claims` — 20 passed. The individual declared commands also
  passed as above.
- `npm run lint` — pass: formatting, Clippy with warnings denied, and strict
  TypeScript.
- `npm run build` — pass; produced `dist/site/` and
  `dist/bin/apply-witness-linux-amd64`.
- `cargo test --doc`, `cargo package --locked`, `npm pack --dry-run --json`,
  `npm audit --audit-level=low`, and `npm audit --omit=dev --audit-level=low`
  — pass. Cargo packaged 12 files; npm reported 29 intended files.

A clean consumer installation from the packaged crate source succeeded with
an isolated `CARGO_TARGET_DIR` and install prefix. The installed binary reports
`apply-witness 0.1.0`; `apply-witness demo --json` exited 2 as designed,
reported 6 applied, 0 changed, and 1 unknown field, and wrote its temporary
receipt. The first install attempt exposed Cargo's target-directory collision
inside the unpacked package tree; rerunning with a separate consumer target
directory succeeded. That is a verification-environment detail, not a product
artifact failure.

## Live product checks

Fresh desktop and phone browser contexts began at scroll position zero and
showed the required first-screen information before scrolling:

- Job: **Verify Supabase config after apply**.
- Audience: **small platform teams who need proof that declared auth settings
  were accepted**.
- First action: **Try it with sample data**, which opens `/demo/`.

The one-click sample immediately displayed a realistic receipt with one
changed field (`auth.jwt_expiry`), one unknown field
(`auth.oauth_server.enabled`), and one applied field (`auth.site_url`). The
visible persistent label was **Demo — sample data, nothing is saved**. In both
fresh contexts, only `demo:config-apply-witness:` storage keys existed; no
normal license key existed. Invalid TOML showed the announced error `Line 3:
expected key = value`; Reset demo restored `jwt_expiry = 3600`; Start for real
cleared every demo key. The sample made no cross-origin request.

Keyboard Space ran the focused witness button and the live focus outline was
3 px. The skip link worked. The home and demo pages had no console or page
errors. Reduced motion produced `scroll-behavior: auto` and a `0.01ms`
animation duration. After an online visit and service-worker-controlled reload,
an offline `/demo/` reload showed the offline notice and all three receipt
rows. This is a static CLI/site product with no owned backend, tenant, health,
restart-persistence, or rate-limit surface; those backend-only checks are not
applicable.

Live Playwright axe scans on home, demo, privacy, terms, and the designed 404
found zero serious or critical violations. The target-size issue above is a
manual geometry finding that axe does not classify as serious or critical.
All routes had one `h1`, one `main`, a header, and a footer; home, demo, privacy,
terms, and 404 titles were correct. The phone layout had no horizontal overflow.
The `/missing-verify-3` request returned HTTP 404 with the designed page and a
way home. The browser's single `Failed to load resource: 404` message for that
deliberate navigation is expected and is not counted as a defect.

`/opt/fleet/lib/verify-url.sh` passed against the live home page: HTTP 200,
634 ms load, no console errors, title/lang/one-h1/main/alt/button checks all
passed. Required internal links returned 200; `mailto:` links are explicit;
the hosted checkout endpoint returned the expected HTTP 303. HTTPS served the
expected CSP, HSTS, frame, referrer, nosniff, and permissions headers. The
service worker was `no-cache`; hashed JavaScript/CSS and the hero were
immutable. `robots.txt` and `sitemap.xml` list the expected routes.

## Earlier findings

| Earlier issue | Current disposition |
| --- | --- |
| Large unequal integers could pass | Fixed. The conservative-classification claim passed the distinct values above 2^53 case with exit 2 and `changed`. |
| Public claims were untested | Fixed. Twenty declared outcome tests passed; no declared claim is untested. |
| Browser and CLI demos were missing | Fixed. `/demo/` and installed `apply-witness demo` use shipped samples and isolation/reset controls. |
| License-cache overwrite retained mode 0644 | Fixed. The license-cache-permissions claim passed. |
| First screen and copy audit were incomplete | Fixed. Job, audience, and sample action appear before scrolling; the copy audit is present. |
| Metadata, routes, footer, CSP, and real 404 were incomplete | Fixed. Live routes, route titles, metadata, headers, sitemap, footer, and HTTP 404 verify. |
| Batch recovery ignored a fresh cache | Fixed. Batch-manifests and daily-license-cache claims passed. |
| `env(...)` values leaked | Fixed. The redaction claim passed. |
| Earlier visible mobile controls were below 44 px | Partly repaired. Main controls meet the baseline, but F1 identifies the remaining legal-page `mailto:` links. |

## Required next step

Repair F1, add its regression, rebuild and deploy, then repeat the live
legal-page phone geometry check. Until that is complete, the unambiguous
verification result remains **FAIL**.
