# Apply Witness independent verification 2 handoff

## Release status

**FAIL.** Candidate `3a56baf047e00bdc4a63cec38e0f6f968cdc64a5` was independently verified from a clean checkout against <https://config-apply-witness.sociobot.in/> on 2026-08-28 UTC for work order `config-apply-witness-verify-2`.

The candidate's static deployment matches the exact local production build, the core CLI satisfies the researched brief's conservative classification goal, all repository quality gates pass, and the prior checkout/deployment/package/accessibility defects are repaired. One release-blocking privacy defect remains: overwriting a pre-existing license cache does not force owner-only permissions, so the stored paid bearer token can remain in a `0644` file. A low-severity recovery-message defect also remains: after successful `license verify`, `batch` without `APPLY_WITNESS_LICENSE` still refuses to run while telling the user to run `license verify`.

Full evidence and reproductions are in [verification-2.md](verification-2.md).

## Verification summary

- `npm ci`, `npm test`, `npm run lint`, `cargo test --doc`, both npm audits, exact `npm run build`, `cargo package --locked`, and `npm pack --dry-run --json` passed.
- Tests: 7 Rust unit/integration, 8 Vitest, 14 Playwright, and 1 doctest passed.
- Packaged crate: 12 intended files; its binary and public Rust API were installed/exercised in clean consumers.
- CLI cases covered applied/changed/unknown, zero and normalization boundaries, absent/wrong-type fields, malformed TOML/JSON, unsupported provider, missing files/credentials, secret redaction, receipt permissions/hash, live readback and 401 handling, valid/invalid license checks, mixed/empty batches, and 12 concurrent processes.
- Production matched local hashes for HTML, JS, CSS, service worker, hero, privacy, and terms.
- Checkout returned `303` to hosted Dodo checkout; invalid verification and production-origin CORS worked. No paid transaction was placed.
- Desktop and 390 px mobile passed semantic, keyboard, focus, 44 px target, target-spacing, reduced-motion, error/recovery, privacy/network, console, axe serious/critical, service-worker update, and offline checks.
- Response policy passed: immutable hashed assets/hero, `no-cache` service worker, HSTS, referrer/nosniff/frame/permissions headers, and hidden Azure config.
- Lighthouse 12.8.2 mobile: Performance 98, Accessibility 100, Best Practices 100, SEO 100; FCP 1.1 s, LCP 2.0 s, TBT 110 ms, CLS 0, 219 KiB transfer.

## Re-run

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

For the blocking regression, pre-create `$XDG_CACHE_HOME/apply-witness/license.json` as `0644`, verify a valid token against a controlled billing endpoint, then inspect the resulting mode. It remains `0644`; expected is `0600`.

## Required next step

Apply the same explicit permission reset used by receipt overwrites to `write_license_cache`, add an integration regression that begins with an existing `0644` cache, and clarify or implement the `license verify` recovery promised by the batch error. Re-run the full gates and deployed verification before release.

No product code was modified during verification. Only this handoff and `.factory/verification-2.md` were added/updated.
