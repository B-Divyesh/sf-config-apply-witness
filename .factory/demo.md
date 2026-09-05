# Apply Witness demo sandbox

## Browser demo

Open `https://config-apply-witness.sociobot.in/demo/`, or choose **Try it with sample data** on the landing page. The page immediately shows a realistic Supabase auth receipt with applied, changed, and unknown fields.

The demo stores only its editable sample inputs under the `demo:config-apply-witness:` local-storage prefix. It never reads or writes the normal website license keys. **Reset demo** replaces edits with the bundled sample. **Start for real** clears every demo-prefixed key and returns home.

## CLI demo

Run:

```sh
apply-witness demo
```

The command copies `examples/supabase-config.toml` and `examples/auth-readback.json` to a new system temporary directory, runs the normal offline witness, writes `witness-receipt.json`, and prints the directory. It makes no provider request. The bundled sample deliberately contains an unmapped OAuth field, so the conservative result exits 2 rather than falsely reporting success.
