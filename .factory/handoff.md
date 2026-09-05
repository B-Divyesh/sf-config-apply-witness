# Apply Witness review 1 handoff

## Result

**FAIL.** Review work order `config-apply-witness-review-1` found 8 defects and 20 untested public claims. The implementation candidate is `a453b1641328f9eb2df7609e1eec0b9e9b0f872a`; the repository documentation reviewed is `7c682bbacf4e4b8cdf03df05ccb79f3b6e5fffc9`.

Full evidence and required changes are in [review-1.md](review-1.md).

## Main blockers

- Different integers above the exact `f64` range can be reported as applied with exit 0.
- `.factory/claims.json` is absent, leaving 20 consolidated public claims without required claim commands.
- The required one-click sample sandbox, `/demo` mode, persistent sample label, reset, CLI demo command, and `.factory/demo.md` are absent.
- An existing CLI license cache can remain `0644` after overwrite.
- First-screen copy, 404/routing, required metadata/CSP, and common footer structure remain incomplete.
- Batch still recommends a recovery action that cannot unlock it.
- The README's environment-substitution redaction claim is false as written.

## Verification completed

- `npm ci`, `npm test`, `npm run lint`, `cargo test --doc`, both npm audits, `npm run build`, `cargo package --locked`, and `npm pack --dry-run --json` passed.
- The packaged CLI was installed in a clean consumer prefix and exercised across normal, invalid, boundary, live-request, license, batch, permission, and recovery cases.
- Live desktop and 390 px phone checks covered sample output, errors and recovery, keyboard, focus, touch size, reduced motion, axe, privacy requests, offline reload, update state, routes, legal pages, links, and the missing 404 behavior.
- Live runtime artifacts match the local production build byte for byte.
- Lighthouse mobile: Performance 99, Accessibility 100, Best Practices 100, SEO 100; LCP 2.0 s, TBT 0 ms, CLS 0, transfer 219 KiB.

## Earlier findings

Checkout, receipt permissions, service-worker privacy, deployment response policy, mobile target size, Cargo packaging, and README language are fixed. License-cache permissions and the batch recovery message remain open.

## Next steps

Fix the integer comparison and license-cache permissions first. Then implement the demo and claims contracts, correct the copy and site structure, add regression coverage for every finding, and repeat deployed verification.

No product code was modified during this review. Only review and handoff reports were changed.
