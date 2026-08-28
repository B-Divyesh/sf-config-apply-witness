import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing page is semantic, interactive, and accessible', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/');
  await expect(page).toHaveTitle(/Apply Witness/);
  await expect(page.locator('h1')).toHaveCount(1);
  await page.getByRole('button', { name: 'Run witness' }).click();
  await expect(page.getByText('Witness receipt')).toBeVisible();
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  await expect(page.getByText('? unknown', { exact: true }).first()).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  expect(errors).toEqual([]);
});

test('empty and invalid states explain the next action', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Declared auth configuration').fill('');
  await page.getByRole('button', { name: 'Run witness' }).click();
  await expect(page.getByRole('alert')).toContainText('Add at least one');
  await page.getByLabel('Declared auth configuration').fill('[auth]\nsite_url="x"');
  await page.getByLabel('Provider JSON readback').fill('{');
  await page.getByRole('button', { name: 'Run witness' }).click();
  await expect(page.getByRole('alert')).toContainText('not valid JSON');
});

test('keyboard flow exposes focus and operates the demo and restore form', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('button', { name: 'Run witness' }).focus();
  await expect(page.getByRole('button', { name: 'Run witness' })).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Space');
  await expect(page.getByText('Witness receipt')).toBeVisible();
  await page.getByRole('button', { name: 'Have a license?' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Paste your license token')).toBeFocused();
});

test('mobile layout has no horizontal overflow and legal routes load', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  const undersized = await page.locator('a, button, input, textarea').evaluateAll(elements => elements.flatMap(element => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || box.width === 0 || box.height === 0) return [];
    return box.width < 44 || box.height < 44 ? [{ label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName, width: box.width, height: box.height }] : [];
  }));
  expect(undersized).toEqual([]);
  await page.goto('/privacy/'); await expect(page.locator('h1')).toHaveText('Privacy');
  await page.goto('/terms/'); await expect(page.locator('h1')).toHaveText('Terms');
});

test('service worker keeps license verification URLs out of Cache Storage', async ({ page, context }) => {
  await context.route('https://api.sociobot.in/api/v1/products/config-apply-witness/verify?license=cache-regression-token', route => route.fulfill({
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    body: JSON.stringify({ valid: false, reason: 'invalid' })
  }));
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.evaluate(() => fetch('https://api.sociobot.in/api/v1/products/config-apply-witness/verify?license=cache-regression-token'));
  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat();
  });
  expect(cachedUrls.some(url => url.includes('license=cache-regression-token'))).toBe(false);
  const cacheNames = await page.evaluate(() => caches.keys());
  expect(cacheNames.some(name => /^apply-witness-[0-9a-f]{12}$/.test(name))).toBe(true);
});

test('checkout return strips and never caches its license query', async ({ page, context }) => {
  await context.route('https://api.sociobot.in/api/v1/products/config-apply-witness/verify?license=return-cache-regression-token', route => route.fulfill({
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' },
    body: JSON.stringify({ valid: false, reason: 'invalid' })
  }));
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.goto('/?license=return-cache-regression-token');
  await expect(page).toHaveURL('/');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('sb_license:config-apply-witness'))).toBe('return-cache-regression-token');
  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.map(async key => (await (await caches.open(key)).keys()).map(request => request.url)))).flat();
  });
  expect(cachedUrls.some(url => url.includes('license='))).toBe(false);
});

test('offline reload preserves the shell and local witness', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status').filter({ hasText: 'offline' })).toBeVisible();
  await page.getByRole('button', { name: 'Run witness' }).click();
  await expect(page.getByText('Witness receipt')).toBeVisible();
});
