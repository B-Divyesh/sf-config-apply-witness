import { copyFile, mkdir } from 'node:fs/promises';
await mkdir(new URL('../dist/bin/', import.meta.url), { recursive: true });
await copyFile(new URL('../target/release/apply-witness', import.meta.url), new URL('../dist/bin/apply-witness-linux-amd64', import.meta.url));
