import { describe, expect, it } from 'vitest';
import { parseSimpleToml, runWitness } from '../site/src/witness';

describe('browser witness', () => {
  it('marks an applied, changed, and ignored field honestly', () => {
    const result = runWitness(`[auth]\nsite_url = "https://app.test"\njwt_expiry = 3600\n[auth.oauth_server]\nenabled = true`, `{"site_url":"https://app.test","jwt_exp":7200}`);
    expect(result.map(field => field.status)).toEqual(['changed', 'unknown', 'applied']);
  });

  it('rejects malformed and empty input', () => {
    expect(() => parseSimpleToml('broken')).toThrow('expected key = value');
    expect(() => runWitness('', '{}')).toThrow('Add at least one');
    expect(() => runWitness('[auth]\nsite_url="x"', '{')).toThrow('not valid JSON');
  });
});
