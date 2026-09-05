# Apply Witness

Apply Witness verifies Supabase configuration after an apply. It is for small platform teams who need to know whether declared auth settings were accepted.

The CLI compares declared settings with provider readback and writes a field-level receipt. A field is `applied`, `changed`, or `unknown`. Changed, omitted, and unreadable fields never pass as applied.

## Try the sample

Open the one-click browser sandbox at [config-apply-witness.sociobot.in/demo/](https://config-apply-witness.sociobot.in/demo/). It starts with a populated receipt, uses the `demo:config-apply-witness:` browser-storage prefix, and never writes normal license storage. See [.factory/demo.md](.factory/demo.md) for reset and isolation details.

The CLI ships the same kind of useful sample:

```sh
apply-witness demo
```

It copies the bundled configuration and readback JSON to a new system temporary directory, runs an offline verification, writes a receipt there, and prints the path. The sample includes an unmapped OAuth field, so it exits `2` rather than falsely reporting success.

## Install

Download a release binary for your platform, or install with Rust:

```sh
cargo install --git https://github.com/B-Divyesh/sf-config-apply-witness --locked
```

## Verify a configuration

For live Supabase readback, put the provider token in the environment. The CLI sends a read-only Management API request and does not print or store the provider token.

```sh
export SUPABASE_ACCESS_TOKEN="your-personal-access-token"
apply-witness verify \
  --provider supabase \
  --project-ref abcdefghijklmnop \
  --config supabase/config.toml \
  --receipt witness-receipt.json
```

For deterministic CI or an offline check, use a captured readback response instead:

```sh
apply-witness verify --provider supabase \
  --config supabase/config.toml \
  --readback examples/auth-readback.json \
  --json
```

Exit `0` means every declared readable field matched. Exit `2` means at least one field changed or is unknown. Exit `1` means the input, credentials, or request failed. JSON is written to stdout and diagnostics to stderr.

Use these commands to inspect the adapter:

```sh
apply-witness adapters
apply-witness schema --provider supabase
apply-witness verify --help
```

`schema` prints every audited declaration-to-readback mapping and its normalization. It includes trimmed string comparison, URL-set comparison that ignores order, and documented inverted booleans. Integer values are compared exactly; browser samples treat large integers as unknown and direct users to the CLI.

## Receipts and redaction

A receipt contains an input SHA-256 hash, timestamp, provider identity, summary, and field results. Receipt files use owner-only permissions on supported Unix systems, including when overwriting an older file.

Paths that look like secrets, and `env(...)` substitutions, are redacted from output. Other declared `[auth]` paths without an audited provider mapping are reported as `unknown`.

## Team Receipt Kit

Single-project verification and receipt export are free. The Team Receipt Kit costs **$29 USD once** and adds batch manifests with compact CI summaries.

```sh
APPLY_WITNESS_LICENSE="license-token" apply-witness batch --manifest witness-jobs.json --json
```

Validate a purchase once to cache its verdict for later batch runs:

```sh
apply-witness license verify --token "license-token"
```

The CLI verifies licenses only with Sociobot’s product API. A fresh valid verdict is reused for up to one day. On supported Unix systems the CLI license cache uses owner-only permissions, including after an overwrite. Restore a website purchase with the pasted-license form on the [product site](https://config-apply-witness.sociobot.in/). A license reported revoked locks Team Receipt Kit features.

## Privacy, terms, and deployment

Apply Witness has no telemetry or behavioral analytics. The browser demo makes no third-party request. The site stores a license only after one is supplied, and removes a returned license from the visible URL. Read the full [Privacy policy](https://config-apply-witness.sociobot.in/privacy/) and [Terms](https://config-apply-witness.sociobot.in/terms/).

The factory deploys the static site from `dist/site/`. Do not add provider or billing credentials to this repository.

## Develop and verify

Install the documented prerequisites, then run:

```sh
npm ci
npm test
npm run lint
npm run build
cargo test --doc
cargo package --locked
npm pack --dry-run --json
```

Every visitor-facing claim is listed in [.factory/claims.json](.factory/claims.json). Run its declared commands from a clean checkout. `npm run build` writes the Rust binary to `dist/bin/` and the static site to `dist/site/`.

Registry publication and release uploads are handled by the factory. The ready-to-publish checks are `cargo package --locked` and `npm pack --dry-run --json`.

## License

MIT. See [LICENSE](LICENSE).
