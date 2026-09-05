import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('landing page names the job, audience, and one-click sample action', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Apply Witness — verify Supabase config after apply');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Verify Supabase config after apply');
  await expect(page.getByText('For small platform teams who need proof that declared auth settings were accepted.')).toBeVisible();
  const sample = page.getByRole('link', { name: 'Try it with sample data' });
  await expect(sample).toBeVisible();
  await sample.click();
  await expect(page).toHaveURL(/\/demo\/$/);
  await expect(page.getByText('Demo — sample data, nothing is saved')).toBeVisible();
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  await expect(page.getByText('! changed', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('? unknown', { exact: true }).first()).toBeVisible();
});

test('demo is isolated, resettable, and recovers from invalid input', async ({ page }) => {
  await page.goto('/demo/');
  await page.getByLabel('Declared auth configuration').fill('');
  await page.getByRole('button', { name: 'Run sample witness' }).click();
  await expect(page.getByRole('alert')).toContainText('Add at least one');
  await page.getByRole('button', { name: 'Reset demo' }).click();
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  await expect(page.getByLabel('Declared auth configuration')).toHaveValue(/auth\.oauth_server/);
  const storageKeys = await page.evaluate(() => Object.keys(localStorage));
  expect(storageKeys.every(key => key.startsWith('demo:config-apply-witness:'))).toBe(true);
  await page.getByRole('link', { name: 'Start for real' }).click();
  await expect(page).toHaveURL('/');
  expect(await page.evaluate(() => Object.keys(localStorage).some(key => key.startsWith('demo:')))).toBe(false);
});

test('demo is semantic, keyboard-operable, and accessible', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/demo/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('button', { name: 'Run sample witness' }).focus();
  await expect(page.getByRole('button', { name: 'Run sample witness' })).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Space');
  await expect(page.getByRole('heading', { name: 'Sample witness receipt' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter(item => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
  expect(errors).toEqual([]);
});

test('mobile layout, route titles, and the designed not-found page work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/demo/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  const undersized = await page.locator('a, button, input, textarea').evaluateAll(elements => elements.flatMap(element => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || box.width === 0 || box.height === 0) return [];
    return box.width < 44 || box.height < 44 ? [{ label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName, width: box.width, height: box.height }] : [];
  }));
  expect(undersized).toEqual([]);
  await page.goto('/privacy/'); await expect(page).toHaveTitle('Privacy — Apply Witness');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How Apply Witness handles data');
  await page.goto('/terms/'); await expect(page).toHaveTitle('Terms — Apply Witness');
  await page.goto('/404.html'); await expect(page).toHaveTitle('Page not found — Apply Witness');
  await expect(page.getByRole('link', { name: 'Go to Apply Witness' })).toBeVisible();
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

test('offline reload preserves the demo shell and sample receipt', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('/demo/');
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('status').filter({ hasText: 'offline' })).toBeVisible();
  await expect(page.locator('.receipt-row')).toHaveCount(3);
  await context.close();
});
