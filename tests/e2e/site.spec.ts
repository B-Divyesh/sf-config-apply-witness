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

test('mobile layout has no horizontal overflow and legal routes load', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
  await page.goto('/privacy/'); await expect(page.locator('h1')).toHaveText('Privacy');
  await page.goto('/terms/'); await expect(page.locator('h1')).toHaveText('Terms');
});
