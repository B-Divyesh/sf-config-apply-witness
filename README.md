# Apply Witness

Apply Witness is a conservative post-apply verification CLI for small teams using hosted developer platforms. It compares declared Supabase configuration with provider readback and produces a field-level receipt: **applied**, **changed**, or **unknown**. An unreadable field is never reported as applied.

## Install

Download a release binary for your platform, or install it with Rust 1.85+:

```sh
cargo install --git https://github.com/B-Divyesh/sf-config-apply-witness --locked
```

## Usage

Verify against live Supabase Management API readback. The access token is read from the environment and is never stored or printed:

```sh
export SUPABASE_ACCESS_TOKEN="your-personal-access-token"
apply-witness verify \
  --provider supabase \
  --project-ref abcdefghijklmnop \
  --config supabase/config.toml \
  --receipt witness-receipt.json
```

For CI and reproducible/offline checks, provide a captured Management API response:

```sh
apply-witness verify --provider supabase \
  --config supabase/config.toml \
  --readback examples/auth-readback.json \
  --json
```

Exit code `0` means every declared readable field was applied. `2` means at least one field is changed or unknown. `1` means the input, credentials, or provider request failed. JSON output is written to stdout; diagnostics go to stderr. The receipt includes a SHA-256 input hash, timestamp, provider/project identity, summary, and redacted field results.

```sh
apply-witness adapters
apply-witness schema --provider supabase
apply-witness verify --help
```

The free CLI verifies one configuration at a time and exports full receipts. The optional one-time Team Receipt Kit adds `batch` manifests and compact CI summaries. Accessibility, safety, secret redaction, and receipt export remain free.

## Supported Supabase fields

The v1 adapter deliberately supports a small, audited mapping of `[auth]` and `[auth.email]` settings returned by `GET /v1/projects/{ref}/config/auth`. `apply-witness schema --provider supabase` prints the exact paths and transformations. Other declared fields are included as `unknown`, never silently skipped. Environment substitutions and secret-like paths are redacted in all output.

## Batch manifests (Team Receipt Kit)

```json
{
  "jobs": [
    {"name":"staging", "provider":"supabase", "project_ref":"abc", "config":"supabase/config.toml"},
    {"name":"production", "provider":"supabase", "project_ref":"xyz", "config":"supabase/config.toml"}
  ]
}
```

```sh
APPLY_WITNESS_LICENSE="license-token" apply-witness batch --manifest witness-jobs.json --json
```

Use `apply-witness license verify --token …` to validate and cache a purchase locally. License validation uses only Sociobot's product API; payment details never reach this tool.

## Develop and verify

```sh
go test ./...
npm install
npm test
npm run build
```

`npm run build` compiles the Go binaries into `dist/bin/` and the static landing/docs site into `dist/site/`. `npm pack` creates the ready-to-publish documentation package; registry publishing and releases are handled by the factory.

## Privacy and security

Apply Witness has no telemetry. Provider tokens remain in environment variables and all provider calls are read-only. Receipt values for paths containing token, secret, password, key, or credential are redacted. The site stores a license token and daily verification verdict only when a buyer supplies one; see [Privacy](https://config-apply-witness.sociobot.in/privacy/) and [Terms](https://config-apply-witness.sociobot.in/terms/).

## License

MIT. See [LICENSE](LICENSE).
