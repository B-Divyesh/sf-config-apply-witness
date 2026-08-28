import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { renderServiceWorker } from './service-worker-template.mjs';

const root = new URL('../dist/site/', import.meta.url).pathname;
async function files(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (await Promise.all(entries.map(async entry => entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)]))).flat();
}
const assetPaths = (await files(root)).filter(path => !path.endsWith('sw.js') && !path.endsWith('.map') && !path.endsWith('staticwebapp.config.json')).sort();
const urls = assetPaths.map(path => '/' + relative(root, path));
const digest = createHash('sha256');
digest.update(renderServiceWorker.toString());
for (const path of assetPaths) {
  digest.update(relative(root, path));
  digest.update(await readFile(path));
}
const cacheName = `apply-witness-${digest.digest('hex').slice(0, 12)}`;
const source = renderServiceWorker(cacheName, urls);
await writeFile(join(root, 'sw.js'), source);
