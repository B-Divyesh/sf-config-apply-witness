import { runWitness, type DemoField, type WitnessStatus } from './witness';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const slug = 'config-apply-witness';
const storagePrefix = `demo:${slug}:`;
const declared = byId<HTMLTextAreaElement>('declared');
const readback = byId<HTMLTextAreaElement>('readback');
const receipt = byId<HTMLElement>('receipt');
const message = byId<HTMLElement>('demo-message');

const sample = {
  declared: `[auth]
site_url = "https://app.example"
jwt_expiry = 3600

[auth.oauth_server]
enabled = true`,
  readback: `{
  "site_url": "https://app.example",
  "jwt_exp": 7200
}`
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
}

function verdict(fields: DemoField[]): WitnessStatus {
  return fields.some(field => field.status === 'changed') ? 'changed' : fields.some(field => field.status === 'unknown') ? 'unknown' : 'applied';
}

function renderReceipt(fields: DemoField[]): void {
  const result = verdict(fields);
  const applied = fields.filter(field => field.status === 'applied').length;
  receipt.innerHTML = `<div class="receipt-head"><div><h2 id="receipt-title">Sample witness receipt</h2><p>${applied}/${fields.length} declared fields witnessed as applied</p></div><strong class="verdict ${result}">${result === 'applied' ? '✓' : result === 'changed' ? '!' : '?'} ${result}</strong></div>${fields.map(field => `<div class="receipt-row"><span class="status ${field.status}">${field.status === 'applied' ? '✓' : field.status === 'changed' ? '!' : '?'} ${field.status}</span><code>${escapeHtml(field.path)}</code><small>${escapeHtml(field.detail)}</small></div>`).join('')}`;
}

function saveDemo(): void {
  localStorage.setItem(`${storagePrefix}declared`, declared.value);
  localStorage.setItem(`${storagePrefix}readback`, readback.value);
}

function clearDemo(): void {
  Object.keys(localStorage)
    .filter(key => key.startsWith(storagePrefix))
    .forEach(key => localStorage.removeItem(key));
}

function run(): void {
  message.hidden = true;
  try {
    renderReceipt(runWitness(declared.value, readback.value));
    saveDemo();
  } catch (error) {
    message.textContent = error instanceof Error ? error.message : 'The sample could not run. Reset the sample and try again.';
    message.hidden = false;
    message.focus();
  }
}

function resetDemo(): void {
  clearDemo();
  declared.value = sample.declared;
  readback.value = sample.readback;
  run();
  byId<HTMLButtonElement>('run-witness').focus();
}

declared.value = localStorage.getItem(`${storagePrefix}declared`) ?? sample.declared;
readback.value = localStorage.getItem(`${storagePrefix}readback`) ?? sample.readback;
run();

byId<HTMLButtonElement>('run-witness').addEventListener('click', run);
byId<HTMLButtonElement>('reset-demo').addEventListener('click', resetDemo);
byId<HTMLAnchorElement>('start-real').addEventListener('click', () => clearDemo());
declared.addEventListener('input', saveDemo);
readback.addEventListener('input', saveDemo);

const offline = byId<HTMLElement>('offline-note');
function syncOnlineState(): void { offline.hidden = navigator.onLine; }
window.addEventListener('online', syncOnlineState);
window.addEventListener('offline', syncOnlineState);
syncOnlineState();

if ('serviceWorker' in navigator && window.isSecureContext) void navigator.serviceWorker.register('/sw.js');
