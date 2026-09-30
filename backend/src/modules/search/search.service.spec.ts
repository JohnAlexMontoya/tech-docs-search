import { toSafeHighlight } from './search.service';

describe('toSafeHighlight', () => {
  it('escapa el HTML del documento y solo después inserta <mark> (previene XSS)', () => {
    const fragment = '<script>alert(1)</script> ⟦kubernetes⟧ & "docker"';
    expect(toSafeHighlight(fragment)).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt; <mark>kubernetes</mark> &amp; &quot;docker&quot;',
    );
  });
});
