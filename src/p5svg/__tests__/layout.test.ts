import { describe, it, expect } from 'vitest';
import { computeLayout } from '../layout';
import { StubMetricsProvider } from '../metrics';
import { mulberry32 } from '../rng';
import { CharMode, Colors, resolveOptions } from '../types';
import { generateP5Svg, EmptyTextError } from '../index';

const metrics = new StubMetricsProvider();
const opts = resolveOptions();

function layout(text: string, seed: number, override = {}) {
  return computeLayout(text, resolveOptions(override), metrics, mulberry32(seed));
}

describe('computeLayout', () => {
  it('marks the first glyph FIRST', () => {
    const r = layout('TAKE YOUR HEART', 1);
    expect(r.glyphs[0].mode).toBe(CharMode.FIRST);
  });

  it('keeps at most one inverted accent per 5-window and never at window boundary', () => {
    for (let seed = 0; seed < 40; seed++) {
      const r = layout('ABCDEFGHIJKLMNOP', seed); // no spaces -> glyph idx == char idx
      const accents = r.glyphs
        .map((g, i) => ({ g, i }))
        .filter(({ g }) => g.mode === CharMode.INVERT)
        .map(({ i }) => i);
      const windows = new Map<number, number>();
      for (const idx of accents) {
        expect(idx).toBeGreaterThanOrEqual(1);
        expect((idx - 1) % 5).not.toBe(4); // boundary index is never eligible
        const w = Math.floor((idx - 1) / 5);
        windows.set(w, (windows.get(w) ?? 0) + 1);
      }
      for (const count of windows.values()) expect(count).toBeLessThanOrEqual(1);
    }
  });

  it('bounds angle to [-9, 9] and scale to {0.8, 0.9, 1.0, 1.1}', () => {
    for (let seed = 0; seed < 25; seed++) {
      const r = layout('THE QUICK BROWN FOX', seed);
      for (const g of r.glyphs) {
        if (g.mode === CharMode.SPACE) continue;
        expect(g.angle).toBeGreaterThanOrEqual(-9);
        expect(g.angle).toBeLessThanOrEqual(9);
        expect([0.8, 0.9, 1.0, 1.1]).toContain(g.scale);
      }
    }
  });

  it('first glyph is white with a black outline and the expected pivot', () => {
    const r = layout('PERSONA', 3);
    const first = r.glyphs[0];
    expect(first.text).not.toBeNull();
    expect(first.text!.fill).toBe(Colors.WHITE);
    expect(first.text!.outlineColor).toBe(Colors.BLACK);
    // pivot formula: cy = padding + outterHeight/2; cx = padding + outterWidth/2 (first offset == padding)
    expect(first.cy).toBeCloseTo(opts.padding + first.outterHeight / 2, 6);
    expect(first.cx).toBeCloseTo(opts.padding + first.outterWidth / 2, 6);
  });

  it('uses contour for the leading/trailing letters and boxes in between', () => {
    const r = layout('TAKE YOUR HEART', 3);
    const letters = r.glyphs.filter((g) => g.mode !== CharMode.SPACE);
    expect(letters[0].style).toBe('contour');
    expect(letters[letters.length - 1].style).toBe('contour');
    // edge letters have no white inner panel (they are not boxed letters)
    expect(letters[0].rects.some((x) => x.role === 'inner')).toBe(false);
    // at least one interior letter is a box with a black rect
    const interior = letters.slice(1, -1);
    expect(interior.every((g) => g.style === 'box')).toBe(true);
    expect(interior.some((g) => g.rects.some((x) => x.role === 'box'))).toBe(true);
  });

  it('every non-space glyph has a brand outline color', () => {
    const allowed = [Colors.BLACK, Colors.WHITE];
    const r = layout('PERSONA', 3);
    for (const g of r.glyphs) {
      if (g.mode === CharMode.SPACE) continue;
      expect(allowed).toContain(g.text!.outlineColor);
    }
  });

  it('inverted glyphs are a black letter with a white outline', () => {
    let inverted = null as ReturnType<typeof layout>['glyphs'][number] | null;
    for (let seed = 0; seed < 80 && !inverted; seed++) {
      inverted =
        layout('ABCDEFGHIJKLMNOP', seed).glyphs.find((g) => g.mode === CharMode.INVERT) ?? null;
    }
    expect(inverted).not.toBeNull();
    expect(inverted!.text?.fill).toBe(Colors.BLACK);
    expect(inverted!.text?.outlineColor).toBe(Colors.WHITE);
    expect(inverted!.text?.edgeColor).toBe(Colors.BLACK);
  });

  it('mixes upper and lower case, keeping the first letter uppercase', () => {
    let sawLower = false;
    let sawUpper = false;
    for (let seed = 0; seed < 40; seed++) {
      const letters = layout('PERSONAFIVE', seed).glyphs.filter((g) => g.text);
      const first = letters[0].text!.char;
      expect(first).toBe(first.toUpperCase());
      for (const g of letters) {
        const c = g.text!.char;
        if (c !== c.toUpperCase()) sawLower = true;
        if (c !== c.toLowerCase()) sawUpper = true;
      }
    }
    expect(sawLower).toBe(true);
    expect(sawUpper).toBe(true);
  });

  it('does not repeat the same font on adjacent letters', () => {
    const fonts = ['A', 'B', 'C', 'D', 'E'];
    for (let seed = 0; seed < 60; seed++) {
      const letters = computeLayout(
        'ABCDEFGHIJKLMNOP',
        resolveOptions({ fonts, heavyFonts: fonts }),
        metrics,
        mulberry32(seed),
      ).glyphs.filter((g) => g.mode !== CharMode.SPACE);
      for (let i = 1; i < letters.length; i++) {
        expect(letters[i].text!.fontFamily).not.toBe(letters[i - 1].text!.fontFamily);
      }
    }
  });

  it('never places two thin letters consecutively', () => {
    const heavy = ['H1', 'H2'];
    const all = ['T1', 'T2', ...heavy];
    for (let seed = 0; seed < 80; seed++) {
      const r = computeLayout(
        'ABCDEFGHIJKLMNOP',
        resolveOptions({ fonts: all, heavyFonts: heavy }),
        metrics,
        mulberry32(seed),
      );
      const letters = r.glyphs.filter((g) => g.mode !== CharMode.SPACE);
      for (let i = 1; i < letters.length; i++) {
        const prevThin = !heavy.includes(letters[i - 1].text!.fontFamily);
        const curThin = !heavy.includes(letters[i].text!.fontFamily);
        expect(prevThin && curThin).toBe(false);
      }
    }
  });

  it('inverted glyphs only use the heavy font pool', () => {
    const heavy = ['H1', 'H2'];
    const all = ['T1', 'T2', 'T3', ...heavy];
    let sawInvert = false;
    for (let seed = 0; seed < 60; seed++) {
      const r = computeLayout(
        'ABCDEFGHIJKLMNOP',
        resolveOptions({ fonts: all, heavyFonts: heavy }),
        metrics,
        mulberry32(seed),
      );
      for (const g of r.glyphs) {
        if (g.mode !== CharMode.INVERT) continue;
        sawInvert = true;
        expect(heavy).toContain(g.text!.fontFamily);
      }
    }
    expect(sawInvert).toBe(true);
  });

  it('swaps fonts across letters when given a font set', () => {
    const r = computeLayout(
      'TAKEYOURHEART',
      resolveOptions({ fonts: ['FA', 'FB', 'FC', 'FD', 'FE'] }),
      metrics,
      mulberry32(1),
    );
    const families = new Set(r.glyphs.filter((g) => g.text).map((g) => g.text!.fontFamily));
    expect(families.size).toBeGreaterThan(1);
  });

  it('truncates input to maxChars', () => {
    const r = layout('ABCDEFGHIJ', 1, { maxChars: 4 });
    expect(r.glyphs).toHaveLength(4);
  });

  it('width bounds the rightmost box plus padding', () => {
    const r = layout('TAKE YOUR HEART', 5);
    const maxRight = Math.max(
      ...r.glyphs.filter((g) => g.mode !== CharMode.SPACE).map((g) => g.cx + g.outterWidth / 2),
    );
    expect(r.width).toBeCloseTo(maxRight + opts.padding, 6);
    expect(r.glyphs.some((g) => g.mode === CharMode.SPACE)).toBe(true);
  });
});

describe('generateP5Svg input guards', () => {
  const deps = { metrics, fontFaceCss: '' };
  it('throws EmptyTextError on empty text', () => {
    expect(() => generateP5Svg('', {}, deps)).toThrow(EmptyTextError);
  });
  it('throws EmptyTextError on whitespace-only text', () => {
    expect(() => generateP5Svg('   ', {}, deps)).toThrow(EmptyTextError);
  });
});
