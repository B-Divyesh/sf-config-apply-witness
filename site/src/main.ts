const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const slug = 'config-apply-witness';
const tokenKey = `sb_license:${slug}`;
const verdictKey = `${tokenKey}:verdict`;
const licenseStatus = byId<HTMLElement>('license-status');
const restoreForm = byId<HTMLFormElement>('restore-form');
const restoreButton = byId<HTMLButtonElement>('show-restore');

interface LicenseVerdict { valid: boolean; reason: string; checkedAt: number }

function cachedVerdict(): LicenseVerdict | null {
  try { return JSON.parse(localStorage.getItem(verdictKey) ?? 'null') as LicenseVerdict | null; }
  catch { return null; }
}

function setLicenseStatus(message: string): void { licenseStatus.textContent = message; }

restoreButton.addEventListener('click', () => {
  restoreForm.hidden = !restoreForm.hidden;
  restoreButton.setAttribute('aria-expanded', String(!restoreForm.hidden));
  if (!restoreForm.hidden) byId<HTMLInputElement>('license-token').focus();
});

async function verifyLicense(token: string, force = false): Promise<void> {
  const cached = cachedVerdict();
  if (!force && cached?.valid && Date.now() - cached.checkedAt < 86_400_000) {
    setLicenseStatus('Team Receipt Kit active. License checked today.');
    return;
  }
  if (!navigator.onLine) {
    setLicenseStatus(cached?.valid
      ? 'Team Receipt Kit is active from the last check. You are offline.'
      : 'License saved. Verification resumes when you are online.');
    return;
  }
  setLicenseStatus('Checking license…');
  try {
    const response = await fetch(`https://api.sociobot.in/api/v1/products/${slug}/verify?license=${encodeURIComponent(token)}`);
    const result = await response.json() as { valid: boolean; reason: string };
    localStorage.setItem(verdictKey, JSON.stringify({ ...result, checkedAt: Date.now() }));
    setLicenseStatus(result.valid
      ? 'Team Receipt Kit active on this device.'
      : 'License no longer active. You can purchase a new license below.');
  } catch {
    setLicenseStatus(cached?.valid
      ? 'Team Receipt Kit is active from the last check. It could not refresh.'
      : 'Could not verify the license. Check your connection and try again.');
  }
}

restoreForm.addEventListener('submit', event => {
  event.preventDefault();
  const token = byId<HTMLInputElement>('license-token').value.trim();
  if (!token) {
    setLicenseStatus('Paste a license token, then verify it.');
    return;
  }
  localStorage.setItem(tokenKey, token);
  void verifyLicense(token, true);
});

const query = new URLSearchParams(location.search);
const returnedLicense = query.get('license');
if (returnedLicense) {
  localStorage.setItem(tokenKey, returnedLicense);
  query.delete('license');
  history.replaceState({}, '', `${location.pathname}${query.size ? `?${query}` : ''}${location.hash}`);
}
const storedLicense = localStorage.getItem(tokenKey);
if (storedLicense) {
  if (cachedVerdict()?.valid) setLicenseStatus('Team Receipt Kit active from your verified license.');
  void verifyLicense(storedLicense);
}

if ('serviceWorker' in navigator && window.isSecureContext) void navigator.serviceWorker.register('/sw.js');
