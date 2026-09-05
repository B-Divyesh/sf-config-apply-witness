export type WitnessStatus = 'applied' | 'changed' | 'unknown';
export interface DemoField { path: string; status: WitnessStatus; detail: string }

const mappings: Record<string, { key: string; invert?: boolean }> = {
  'auth.site_url': { key: 'site_url' },
  'auth.jwt_expiry': { key: 'jwt_exp' },
  'auth.enable_signup': { key: 'disable_signup', invert: true },
  'auth.email.enable_signup': { key: 'external_email_enabled' },
  'auth.email.enable_confirmations': { key: 'mailer_autoconfirm', invert: true }
};

export function parseSimpleToml(source: string): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  let section = '';
  source.split(/\r?\n/).forEach((original, index) => {
    const line = original.replace(/#.*$/, '').trim();
    if (!line) return;
    if (line.startsWith('[') && line.endsWith(']')) { section = line.slice(1, -1).trim(); return; }
    const equal = line.indexOf('=');
    if (equal < 1) throw new Error(`Line ${index + 1}: expected key = value`);
    const key = `${section ? `${section}.` : ''}${line.slice(0, equal).trim()}`;
    const raw = line.slice(equal + 1).trim();
    if (/^".*"$/.test(raw) || /^'.*'$/.test(raw)) values[key] = raw.slice(1, -1);
    else if (raw === 'true' || raw === 'false') values[key] = raw === 'true';
    else if (/^-?\d+(\.\d+)?$/.test(raw)) values[key] = Number(raw);
    else throw new Error(`Line ${index + 1}: unsupported value`);
  });
  return values;
}

export function runWitness(declaredText: string, readbackText: string): DemoField[] {
  if (!declaredText.trim()) throw new Error('Add at least one declared [auth] field.');
  if (!readbackText.trim()) throw new Error('Add the provider JSON readback.');
  const declared = parseSimpleToml(declaredText);
  let readback: Record<string, unknown>;
  try { readback = JSON.parse(readbackText) as Record<string, unknown>; }
  catch { throw new Error('Readback is not valid JSON. Check quotes and commas.'); }
  const paths = Object.keys(declared).filter(path => path.startsWith('auth.')).sort();
  if (!paths.length) throw new Error('No [auth] fields were declared.');
  return paths.map(path => {
    const mapping = mappings[path];
    if (!mapping) return { path, status: 'unknown', detail: 'No audited provider readback mapping' };
    if (!(mapping.key in readback)) return { path, status: 'unknown', detail: 'Absent from provider readback' };
    const raw = readback[mapping.key];
    if (mapping.invert && typeof raw !== 'boolean') return { path, status: 'unknown', detail: 'Provider returned the wrong value type' };
    const observed = mapping.invert ? !raw : raw;
    if (isUnsafeBrowserInteger(declared[path]) || isUnsafeBrowserInteger(observed)) {
      return { path, status: 'unknown', detail: 'Large integers need the CLI for an exact comparison' };
    }
    return Object.is(declared[path], observed)
      ? { path, status: 'applied', detail: 'Declared value matches readback' }
      : { path, status: 'changed', detail: `Declared ${JSON.stringify(declared[path])}; read back ${JSON.stringify(observed)}` };
  });
}

function isUnsafeBrowserInteger(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value);
}
