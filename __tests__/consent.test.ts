import { ConsentRegistry } from '../src/core/consent';
const setup = () => { const r = new ConsentRegistry(); r.open('m', 'M', 's1'); return r; };
test('terms alone grant nothing', () => {
  const r = setup(); r.acceptTerms('m', true, true);
  expect(r.validate('m', 's1', 'content://x/tree/a/document/a%2Ff').ok).toBe(false);
});
test('cannot accept without scrolling+ticking', () => { expect(setup().acceptTerms('m', true, false).ok).toBe(false); });
test('scope, revoke, and independence', () => {
  const r = setup(); r.open('m2', 'M2', 's2');
  r.acceptTerms('m', true, true); r.grantFiles('m', ['content://x/tree/a']);
  expect(r.validate('m', 's1', 'content://x/tree/a/document/f').ok).toBe(true);
  expect(r.validate('m', 's1', 'content://x/tree/b/document/f').ok).toBe(false);
  expect(r.validate('m', 's1', 'content://x/tree/a/../b').ok).toBe(false);
  expect(r.validate('m2', 's2', 'content://x/tree/a/document/f').ok).toBe(false);
  r.revoke('m');
  expect(r.validate('m', 's1', 'content://x/tree/a/document/f').ok).toBe(false);
  r.requestAgain('m'); expect(r.get('m')!.state).toBe('FILE_PERMISSION_PENDING');
});
test('expired session denied', () => {
  let t = 0; const r = new ConsentRegistry(() => t); r.open('m', 'M', 's', 1000);
  r.acceptTerms('m', true, true); r.grantFiles('m', ['u']); t = 5000;
  expect(r.validate('m', 's', 'u').ok).toBe(false);
});
