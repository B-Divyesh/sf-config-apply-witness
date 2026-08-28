import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { renderServiceWorker } from '../scripts/service-worker-template.mjs';

describe('release policy regressions', () => {
  it('keeps npm dependencies out of the Cargo package', () => {
    const members = execFileSync('cargo', ['package', '--list', '--allow-dirty'], { encoding: 'utf8' })
      .trim()
      .split('\n');
    expect(members.some(path => path.startsWith('node_modules/'))).toBe(false);
    expect(members).toContain('src/main.rs');
    expect(members).toContain('README.md');
  });

  it('declares Azure Static Web Apps response policies', () => {
    const config = JSON.parse(readFileSync('site/public/staticwebapp.config.json', 'utf8'));
    const routes = Object.fromEntries(config.routes.map((route: { route: string; headers: Record<string, string> }) => [route.route, route.headers]));
    expect(routes['/assets/*']['Cache-Control']).toContain('immutable');
    expect(routes['/witness-press.webp']['Cache-Control']).toContain('immutable');
    expect(routes['/sw.js']['Cache-Control']).toBe('no-cache');
    expect(config.globalHeaders['X-Frame-Options']).toBe('DENY');
    expect(config.globalHeaders['Permissions-Policy']).toContain('camera=()');
  });

  it('never intercepts or caches cross-origin license requests', () => {
    const listeners = new Map<string, (event: { request: Request; respondWith: (response: Promise<Response>) => void }) => void>();
    const cachePut = vi.fn();
    const fakeSelf = {
      location: { origin: 'https://config-apply-witness.sociobot.in' },
      addEventListener: (name: string, listener: (event: { request: Request; respondWith: (response: Promise<Response>) => void }) => void) => listeners.set(name, listener),
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() }
    };
    const fakeCaches = {
      open: vi.fn(async () => ({ addAll: vi.fn(), put: cachePut })),
      keys: vi.fn(async () => []),
      delete: vi.fn(),
      match: vi.fn()
    };
    const fakeFetch = vi.fn();
    const source = renderServiceWorker('apply-witness-test', ['/index.html']);
    new Function('self', 'caches', 'fetch', source)(fakeSelf, fakeCaches, fakeFetch);
    const respondWith = vi.fn();

    listeners.get('fetch')!({
      request: new Request('https://api.sociobot.in/api/v1/products/config-apply-witness/verify?license=private-token'),
      respondWith
    });

    expect(respondWith).not.toHaveBeenCalled();
    expect(fakeCaches.open).not.toHaveBeenCalled();
    expect(cachePut).not.toHaveBeenCalled();
  });

  it('honors no-store on same-origin responses', async () => {
    let fetchListener: ((event: { request: Request; respondWith: (response: Promise<Response>) => void }) => void) | undefined;
    const cachePut = vi.fn();
    const fakeSelf = {
      location: { origin: 'https://config-apply-witness.sociobot.in' },
      addEventListener: (name: string, listener: typeof fetchListener) => { if (name === 'fetch') fetchListener = listener; },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() }
    };
    const fakeCaches = {
      open: vi.fn(async () => ({ addAll: vi.fn(), put: cachePut })),
      keys: vi.fn(async () => []),
      delete: vi.fn(),
      match: vi.fn(async () => undefined)
    };
    const source = renderServiceWorker('apply-witness-test', ['/index.html']);
    new Function('self', 'caches', 'fetch', source)(
      fakeSelf,
      fakeCaches,
      vi.fn(async () => new Response('{}', { status: 200, headers: { 'Cache-Control': 'private, no-store' } }))
    );
    let handled: Promise<Response> | undefined;
    fetchListener!({
      request: new Request('https://config-apply-witness.sociobot.in/private.json'),
      respondWith: response => { handled = response; }
    });
    await handled;
    expect(cachePut).not.toHaveBeenCalled();
  });
});
