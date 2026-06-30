import { describe, it, expect } from 'vitest';
import { computeLayout } from '../layout';
import { renderSvg } from '../render';
import { StubMetricsProvider } from '../metrics';
import { mulberry32 } from '../rng';
import { Colors, Options, resolveOptions } from '../types';
import { generateP5Svg } from '../index';

const metrics = new StubMetricsProvider();

function svg(text: string, options: Options = {}, seed = 1) {
  const opts = resolveOptions(options);
  const layout = computeLayout(text, opts, metrics, mulberry32(seed));
  return renderSvg(layout, opts, '');
}

const round2 = (x: number) => Math.round(x * 100) / 100;

function glyphGroup(s: string): string {
  const start = s.indexOf('<g id="glyphs"');
  return s.slice(start, s.indexOf('</svg>'));
}

describe('renderSvg', () => {
  it('default output is transparent with no outline', () => {
    const s = svg('TAKE YOUR HEART');
    expect(s).toContain('<svg');
    expect(s).not.toContain('id="bg-fill"');
    expect(s).not.toContain('id="bg-burst"');
    expect(s).not.toContain('p5-sticker');
    expect(s).toContain('<g id="glyphs">'); // no filter attribute
  });

  it('emits exactly one full-bleed rect when a fill is set', () => {
    const s = svg('ABC', { background: { fill: '#1133aa' } });
    const matches = s.match(/id="bg-fill"/g) ?? [];
    expect(matches).toHaveLength(1);
    expect(s).toContain('fill="#1133aa"');
  });

  it('emits burst circles when burst is enabled', () => {
    const s = svg('ABC', { background: { burst: true } });
    expect(s).toContain('id="bg-burst"');
    expect(s).toContain('<circle');
  });

  it('supports fill and burst together', () => {
    const s = svg('ABC', { background: { fill: '#000', burst: true } });
    expect(s).toContain('id="bg-fill"');
    expect(s).toContain('id="bg-burst"');
  });

  it('emits the sticker outline filter only when outline is enabled', () => {
    expect(svg('ABC')).not.toContain('p5-sticker');
    const s = svg('ABC', { outline: { enabled: true } });
    expect(s).toContain('<filter id="p5-sticker"');
    expect(s).toContain('filter="url(#p5-sticker)"');
    expect(s).toContain('feMorphology');
    // outline color floods the dilated silhouette
    expect(s).toContain(`flood-color="${Colors.WHITE}"`);
  });

  it('uses a custom outline color and radius when given', () => {
    const s = svg('ABC', { outline: { enabled: true, color: '#00ffaa', radius: 7 } });
    expect(s).toContain('flood-color="#00ffaa"');
    expect(s).toContain('radius="7"');
  });

  it('uses only the three brand colors inside the glyph collage', () => {
    const s = svg('TAKE YOUR HEART', { background: { fill: '#abcdef', burst: true } });
    const group = glyphGroup(s);
    const fills = [...group.matchAll(/fill="(#[0-9A-Fa-f]{3,6})"/g)].map((m) => m[1]);
    expect(fills.length).toBeGreaterThan(0);
    const allowed = new Set<string>([Colors.RED, Colors.WHITE, Colors.BLACK]);
    for (const f of fills) expect(allowed.has(f)).toBe(true);
  });

  it('rotates all 3 first-glyph layers about one shared pivot', () => {
    const opts = resolveOptions();
    const layout = computeLayout('PERSONA', opts, metrics, mulberry32(3));
    const first = layout.glyphs[0];
    const s = renderSvg(layout, opts, '');
    const pivotEnd = `${round2(first.cx)} ${round2(first.cy)})`;
    const count = s.split(pivotEnd).length - 1;
    // 2 rects + 1 text, all sharing the exact same pivot coordinates
    expect(count).toBe(3);
  });

  it('is deterministic for a fixed seed + options', () => {
    expect(svg('TAKE YOUR HEART', {}, 42)).toEqual(svg('TAKE YOUR HEART', {}, 42));
  });

  it('drops an invalid/unsafe background fill (no bg-fill rect)', () => {
    const s = svg('ABC', { background: { fill: '#000" onload="x' } });
    expect(s).not.toContain('id="bg-fill"');
    expect(s).not.toContain('onload');
  });

  it('keeps valid color formats (hex, named, rgb)', () => {
    expect(svg('ABC', { background: { fill: '#abc' } })).toContain('id="bg-fill"');
    expect(svg('ABC', { background: { fill: 'rebeccapurple' } })).toContain('fill="rebeccapurple"');
    expect(svg('ABC', { background: { fill: 'rgb(10, 20, 30)' } })).toContain('id="bg-fill"');
  });

  it('injects the provided font-face CSS into <defs>', () => {
    const css = "@font-face{font-family:'P5Display';src:url(data:font/woff2;base64,AAAA)}";
    const result = generateP5Svg('TAKE YOUR HEART', { seed: 7 }, { metrics, fontFaceCss: css });
    expect(result.svg).toContain('<defs>');
    expect(result.svg).toContain('@font-face');
    expect(result.svg).toContain('P5Display');
  });
});
