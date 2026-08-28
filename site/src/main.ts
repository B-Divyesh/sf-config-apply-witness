import { runWitness, type DemoField, type WitnessStatus } from './witness';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const declared = byId<HTMLTextAreaElement>('declared');
const readback = byId<HTMLTextAreaElement>('readback');
const receipt = byId<HTMLElement>('receipt');
const message = byId<HTMLElement>('demo-message');

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
}

function verdict(fields: DemoField[]): WitnessStatus {
  return fields.some(field => field.status === 'changed') ? 'changed' : fields.some(field => field.status === 'unknown') ? 'unknown' : 'applied';
}

function renderReceipt(fields: DemoField[]): void {
  const result = verdict(fields);
  const applied = fields.filter(field => field.status === 'applied').length;
  receipt.innerHTML = `<div class="receipt-head"><div><h3 id="receipt-title">Witness receipt</h3><p>${applied}/${fields.length} declared fields witnessed as applied</p></div><strong class="verdict ${result}">${result === 'applied' ? '✓' : result === 'changed' ? '!' : '?'} ${result}</strong></div>${fields.map(field => `<div class="receipt-row"><span class="status ${field.status}">${field.status === 'applied' ? '✓' : field.status === 'changed' ? '!' : '?'} ${field.status}</span><code>${escapeHtml(field.path)}</code><small>${escapeHtml(field.detail)}</small></div>`).join('')}`;
}

byId<HTMLButtonElement>('run-witness').addEventListener('click', () => {
  message.hidden = true;
  try { renderReceipt(runWitness(declared.value, readback.value)); }
  catch (error) { message.textContent = error instanceof Error ? error.message : 'The witness could not run.'; message.hidden = false; message.focus(); }
});

byId<HTMLButtonElement>('copy-command').addEventListener('click', async () => {
  const status = byId<HTMLElement>('copy-status');
  try { await navigator.clipboard.writeText(byId<HTMLElement>('install-command').textContent ?? ''); status.textContent = 'Command copied.'; byId<HTMLButtonElement>('copy-command').textContent = 'Copied'; }
  catch { status.textContent = 'Copy was unavailable. Select the command text instead.'; }
});

const offline = byId<HTMLElement>('offline-note');
function syncOnlineState(): void { offline.hidden = navigator.onLine; }
window.addEventListener('online', syncOnlineState); window.addEventListener('offline', syncOnlineState); syncOnlineState();

const slug = 'config-apply-witness';
const tokenKey = `sb_license:${slug}`;
const verdictKey = `${tokenKey}:verdict`;
const licenseStatus = byId<HTMLElement>('license-status');
const restoreForm = byId<HTMLFormElement>('restore-form');
const restoreButton = byId<HTMLButtonElement>('show-restore');

restoreButton.addEventListener('click', () => {
  restoreForm.hidden = !restoreForm.hidden;
  restoreButton.setAttribute('aria-expanded', String(!restoreForm.hidden));
  if (!restoreForm.hidden) byId<HTMLInputElement>('license-token').focus();
});

interface LicenseVerdict { valid: boolean; reason: string; checkedAt: number }
function cachedVerdict(): LicenseVerdict | null { try { return JSON.parse(localStorage.getItem(verdictKey) ?? 'null') as LicenseVerdict | null; } catch { return null; } }

async function verifyLicense(token: string, force = false): Promise<void> {
  const cached = cachedVerdict();
  if (!force && cached?.valid && Date.now() - cached.checkedAt < 86_400_000) { licenseStatus.textContent = 'Team Receipt Kit active. License checked today.'; return; }
  if (!navigator.onLine) { licenseStatus.textContent = cached?.valid ? 'Team Receipt Kit active from the last verified license. Offline now.' : 'License saved. Verification will resume when you are online.'; return; }
  licenseStatus.textContent = 'Checking license…';
  try {
    const response = await fetch(`https://api.sociobot.in/api/v1/products/${slug}/verify?license=${encodeURIComponent(token)}`);
    const result = await response.json() as { valid: boolean; reason: string };
    localStorage.setItem(verdictKey, JSON.stringify({ ...result, checkedAt: Date.now() }));
    licenseStatus.textContent = result.valid ? 'Team Receipt Kit active on this device.' : 'License no longer active. You can purchase a new license below.';
  } catch { licenseStatus.textContent = cached?.valid ? 'Team Receipt Kit active from the last check. Could not refresh while offline.' : 'Could not verify the license. Check your connection and try again.'; }
}

restoreForm.addEventListener('submit', event => {
  event.preventDefault(); const token = byId<HTMLInputElement>('license-token').value.trim();
  if (!token) { licenseStatus.textContent = 'Paste a license token first.'; return; }
  localStorage.setItem(tokenKey, token); void verifyLicense(token, true);
});

const query = new URLSearchParams(location.search);
const returnedLicense = query.get('license');
if (returnedLicense) { localStorage.setItem(tokenKey, returnedLicense); query.delete('license'); history.replaceState({}, '', `${location.pathname}${query.size ? `?${query}` : ''}${location.hash}`); }
const storedLicense = localStorage.getItem(tokenKey);
if (storedLicense) { const cached = cachedVerdict(); if (cached?.valid) licenseStatus.textContent = 'Team Receipt Kit active from your verified license.'; void verifyLicense(storedLicense); }

if ('serviceWorker' in navigator && window.isSecureContext) void navigator.serviceWorker.register('/sw.js');
