import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const repository = process.cwd();

test.describe.configure({ mode: 'serial' });

function runCli(args: string[], environment: NodeJS.ProcessEnv = {}): ReturnType<typeof spawnSync> {
  return spawnSync('cargo', ['run', '--quiet', '--', ...args], {
    cwd: repository,
    encoding: 'utf8',
    env: { ...process.env, ...environment }
  });
}

function temporaryDirectory(label: string): string {
  return mkdtempSync(join(tmpdir(), `apply-witness-${label}-`));
}

async function openDemo(page: Page): Promise<void> {
  await page.goto('/demo/');
  await expect(page.locator('.receipt-row')).toHaveCount(3);
}

test('@claim:conservative-classification marks changed and unreadable fields non-successfully', async ({ page }) => {
  await openDemo(page);
  await expect(page.getByText('! changed', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('? unknown', { exact: true }).first()).toBeVisible();
  const directory = temporaryDirectory('large-integer');
  try {
    writeFileSync(join(directory, 'config.toml'), '[auth]\njwt_expiry = 9007199254740992\n');
    writeFileSync(join(directory, 'readback.json'), '{"jwt_exp":9007199254740993}');
    const outcome = runCli(['verify', '--config', join(directory, 'config.toml'), '--readback', join(directory, 'readback.json'), '--json']);
    expect(outcome.status).toBe(2);
    expect(JSON.parse(outcome.stdout as string).conclusion).toBe('changed');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('@claim:audited-mappings lists the readback mapping and normalization', async ({ page }) => {
  await openDemo(page);
  const outcome = runCli(['schema', '--provider', 'supabase']);
  expect(outcome.status).toBe(0);
  expect(outcome.stdout).toContain('auth.additional_redirect_urls -> uri_allow_list (trimmed URL set; order ignored)');
  expect(outcome.stdout).toContain('auth.enable_signup -> disable_signup (provider boolean is inverted)');
});

test('@claim:read-only-live-readback uses the tested GET consumer path', async ({ page }) => {
  await openDemo(page);
  const outcome = spawnSync('cargo', ['test', '--test', 'cli', 'live_readback_is_a_get_and_never_prints_the_provider_token'], { cwd: repository, encoding: 'utf8' });
  expect(outcome.status).toBe(0);
  expect(outcome.stdout).toContain('1 passed');
});

test('@claim:provider-token-privacy never prints a provider token from the live path', async ({ page }) => {
  await openDemo(page);
  const outcome = spawnSync('cargo', ['test', '--test', 'cli', 'live_readback_is_a_get_and_never_prints_the_provider_token'], { cwd: repository, encoding: 'utf8' });
  expect(outcome.status).toBe(0);
  expect(`${outcome.stdout}${outcome.stderr}`).not.toContain('private-provider-token');
});

test('@claim:redaction hides secret-like values and environment substitutions', async ({ page }) => {
  await openDemo(page);
  const outcome = spawnSync('cargo', ['test', '--test', 'cli', 'environment_substitutions_are_redacted_from_cli_output'], { cwd: repository, encoding: 'utf8' });
  expect(outcome.status).toBe(0);
  expect(outcome.stdout).toContain('1 passed');
});

test('@claim:no-telemetry makes no third-party request during the demo', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await openDemo(page);
  expect(requests.every(url => new URL(url).origin === 'http://127.0.0.1:4173')).toBe(true);
});

test('@claim:browser-demo-local keeps the sample in its demo storage namespace', async ({ page }) => {
  await openDemo(page);
  const keys = await page.evaluate(() => Object.keys(localStorage));
  expect(keys).toEqual(expect.arrayContaining(['demo:config-apply-witness:declared', 'demo:config-apply-witness:readback']));
  expect(keys.every(key => key.startsWith('demo:config-apply-witness:'))).toBe(true);
});

test('@claim:fixture-no-provider-request runs the bundled CLI sample without credentials', async ({ page }) => {
  await openDemo(page);
  const outcome = runCli(['demo', '--json'], { SUPABASE_ACCESS_TOKEN: '' });
  expect(outcome.status).toBe(2);
  const result = JSON.parse(outcome.stdout as string);
  expect(result.receipt.readback_source).toBe('file:auth-readback.json');
  rmSync(result.demo_directory, { recursive: true, force: true });
});

test('@claim:offline-demo-reload works offline after the first visit', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await openDemo(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status').filter({ hasText: 'offline' })).toBeVisible();
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  await context.close();
});

test('@claim:exit-codes uses 0 for applied, 2 for policy failure, and 1 for input errors', async ({ page }) => {
  await openDemo(page);
  const directory = temporaryDirectory('exit-codes');
  try {
    writeFileSync(join(directory, 'config.toml'), "[auth]\nsite_url = 'https://example.test'\n");
    writeFileSync(join(directory, 'readback.json'), '{"site_url":"https://example.test"}');
    expect(runCli(['verify', '--config', join(directory, 'config.toml'), '--readback', join(directory, 'readback.json'), '--json']).status).toBe(0);
    writeFileSync(join(directory, 'readback.json'), '{}');
    expect(runCli(['verify', '--config', join(directory, 'config.toml'), '--readback', join(directory, 'readback.json'), '--json']).status).toBe(2);
    expect(runCli(['verify', '--config', join(directory, 'missing.toml'), '--readback', join(directory, 'readback.json')]).status).toBe(1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('@claim:receipt-content writes the hash, identity, results, and redacted values', async ({ page }) => {
  await openDemo(page);
  const outcome = runCli(['demo', '--json']);
  expect(outcome.status).toBe(2);
  const result = JSON.parse(outcome.stdout as string);
  expect(result.receipt.input_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(result.receipt.provider).toBe('supabase');
  expect(result.receipt.summary).toEqual({ applied: 6, changed: 0, unknown: 1, total: 7 });
  expect(JSON.parse(readFileSync(result.receipt_path, 'utf8'))).toMatchObject({ receipt_id: result.receipt.receipt_id });
  rmSync(result.demo_directory, { recursive: true, force: true });
});

test('@claim:receipt-permissions forces owner-only receipt permissions', async ({ page }) => {
  await openDemo(page);
  const outcome = spawnSync('cargo', ['test', '--test', 'cli', 'replacing_a_receipt_forces_owner_only_permissions'], { cwd: repository, encoding: 'utf8' });
  expect(outcome.status).toBe(0);
  expect(outcome.stdout).toContain('1 passed');
});

test('@claim:cli-demo runs one command and reports the temporary output location', async ({ page }) => {
  await openDemo(page);
  const outcome = runCli(['demo']);
  expect(outcome.status).toBe(2);
  expect(outcome.stdout).toContain('sample files are in');
  const match = (outcome.stdout as string).match(/sample files are in (.+)\n/);
  expect(match).not.toBeNull();
  if (match) rmSync(match[1], { recursive: true, force: true });
});

test('@claim:free-single-project verifies one project without a license', async ({ page }) => {
  await openDemo(page);
  const outcome = runCli(['verify', '--config', 'examples/supabase-config.toml', '--readback', 'examples/auth-readback.json', '--json'], { APPLY_WITNESS_LICENSE: '' });
  expect(outcome.status).toBe(2);
  expect(JSON.parse(outcome.stdout as string).summary.applied).toBe(6);
});

test('@claim:batch-manifests uses a cached valid license for several-project mode', async ({ page }) => {
  await openDemo(page);
  const outcome = spawnSync('cargo', ['test', '--test', 'cli', 'replacing_a_license_cache_forces_owner_only_permissions_and_unlocks_batch'], { cwd: repository, encoding: 'utf8' });
  expect(outcome.status).toBe(0);
  expect(outcome.stdout).toContain('1 passed');
});

test('@claim:daily-license-cache reuses a fresh valid local verdict', async ({ page }) => {
  await openDemo(page);
  const outcome = spawnSync('cargo', ['test', '--test', 'cli', 'replacing_a_license_cache_forces_owner_only_permissions_and_unlocks_batch'], { cwd: repository, encoding: 'utf8' });
  expect(outcome.status).toBe(0);
  expect(outcome.stdout).toContain('1 passed');
});

test('@claim:website-license-storage stores supplied licenses locally and strips the URL', async ({ page, context }) => {
  await context.route('https://api.sociobot.in/api/v1/products/config-apply-witness/verify?license=claim-license', route => route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: '{"valid":false,"reason":"invalid"}' }));
  await page.goto('/?license=claim-license');
  await expect(page).toHaveURL('/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sb_license:config-apply-witness'))).toBe('claim-license');
  expect(await page.evaluate(() => localStorage.getItem('demo:config-apply-witness:declared'))).toBeNull();
});

test('@claim:license-cache-permissions replaces an unsafe cache with owner-only mode', async ({ page }) => {
  await openDemo(page);
  const outcome = spawnSync('cargo', ['test', '--test', 'cli', 'replacing_a_license_cache_forces_owner_only_permissions_and_unlocks_batch'], { cwd: repository, encoding: 'utf8' });
  expect(outcome.status).toBe(0);
  expect(outcome.stdout).toContain('1 passed');
});

test('@claim:price-and-restore shows the one-time price and restores a pasted license', async ({ page, context }) => {
  await context.route('https://api.sociobot.in/api/v1/products/config-apply-witness/verify?license=restored-license', route => route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: '{"valid":true,"reason":"ok"}' }));
  await page.goto('/');
  await expect(page.getByText('The Team Receipt Kit adds batch manifests and compact CI summaries. It costs $29 USD once.')).toBeVisible();
  await page.getByRole('button', { name: 'Restore a license' }).click();
  await page.getByLabel('Paste your license token').fill('restored-license');
  await page.getByRole('button', { name: 'Verify license' }).click();
  await expect(page.getByRole('status')).toContainText('active on this device');
});

test('@claim:revoked-license locks paid features after verification', async ({ page, context }) => {
  await context.route('https://api.sociobot.in/api/v1/products/config-apply-witness/verify?license=revoked-license', route => route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' }, body: '{"valid":false,"reason":"revoked"}' }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Restore a license' }).click();
  await page.getByLabel('Paste your license token').fill('revoked-license');
  await page.getByRole('button', { name: 'Verify license' }).click();
  await expect(page.getByRole('status')).toContainText('License no longer active');
});
