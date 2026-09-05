# Apply Witness verification 3 handoff

## Release status

**FAIL — one low-severity live accessibility finding remains.** The reviewed
runtime is `d56e3fd1714c49f85f9099688d998fcb5a5a3e04`; this verification and
the prior documentation head are `d5400d220e1ecbebe898dd0d0f20707fc8767580`.
The live URL is <https://config-apply-witness.sociobot.in/>.

The local-first Rust CLI correctly compares declared Supabase auth settings
with readback and produces applied, changed, or unknown receipts. The browser
and CLI demos, claims, package, and live main flow all verify. Do not mark the
release accepted yet: the email links on `/privacy/` and `/terms/` are only 18
px high at the 390 px phone viewport, below the required 44 px touch target.

## What verification 3 checked

- Fresh `npm ci`, `npm test`, all 20 declared claim commands,
  `npm run lint`, `npm run build`, doctests, Cargo package, npm pack, and both
  audits passed.
- A clean installed package consumer ran `apply-witness 0.1.0` and
  `apply-witness demo --json`; the bundled sample reported 6 applied and 1
  unknown field and wrote a temporary receipt.
- The live deployment matches the local candidate byte-for-byte for its HTML,
  CSS, JavaScript, service worker, hero, and CLI recording. HTTP routes,
  headers, cache policy, sitemap, robots file, hosted checkout redirect, and
  designed HTTP 404 verify.
- Fresh desktop and phone demos showed the job, audience, first action,
  populated receipt, persistent sample label, reset, exit cleanup, invalid
  input recovery, local demo storage, keyboard focus, no cross-origin demo
  request, reduced motion, and offline reload.
- Live axe scans had no serious or critical findings. Manual mobile geometry
  found the remaining legal-page mailto target defect.

## Required repair and recheck

Make the two legal-page contact links at least 44 px tall and add a regression
covering their phone geometry. Rebuild, deploy, and repeat the live legal-page
touch-target check. The detailed evidence and all earlier-finding dispositions
are in `.factory/verification-3.md`.

## Known scope limits

No real Supabase account, paid purchase, or refund was used. Controlled local
tests cover provider request, token privacy, license, cache, and revocation
behaviors without credentials. This is a static CLI/site product, so backend
tenant isolation, database persistence, health, restart, and 429 checks do not
apply. Registry publication remains the factory's responsibility.
