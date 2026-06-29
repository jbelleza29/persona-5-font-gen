export interface GlyphSize {
  width: number;
  height: number;
  /** Ink top offset from the em-box top (textBaseline 'top'). */
  top: number;
  /** Ink left offset from the pen x. */
  left: number;
}

export interface GlyphMetricsProvider {
  measure(char: string, fontPx: number, fontFamily: string, weight: string): GlyphSize;
}

/**
 * Canvas-backed metrics using TextMetrics.actualBoundingBox*. Falls back to a
 * rough estimate when those fields are unavailable (older browsers).
 */
export class CanvasMetricsProvider implements GlyphMetricsProvider {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas?: HTMLCanvasElement) {
    const c = canvas ?? document.createElement('canvas');
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  measure(char: string, fontPx: number, fontFamily: string, weight: string): GlyphSize {
    const ctx = this.ctx;
    ctx.font = `${weight} ${fontPx}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    const m = ctx.measureText(char);

    const hasBox =
      typeof m.actualBoundingBoxLeft === 'number' &&
      typeof m.actualBoundingBoxAscent === 'number';

    if (hasBox) {
      const left = m.actualBoundingBoxLeft;
      const right = m.actualBoundingBoxRight;
      const top = m.actualBoundingBoxAscent;
      const bottom = m.actualBoundingBoxDescent;
      return {
        width: Math.max(1, left + right),
        height: Math.max(1, top + bottom),
        top,
        left,
      };
    }

    // Fallback: width from advance, height from font size.
    return {
      width: Math.max(1, m.width),
      height: fontPx,
      top: 0,
      left: 0,
    };
  }
}

/**
 * Deterministic, font-free metrics for unit tests (jsdom has no real canvas
 * text measurement). Proportions are arbitrary but stable.
 */
export class StubMetricsProvider implements GlyphMetricsProvider {
  measure(char: string, fontPx: number): GlyphSize {
    const wide = /[MW]/.test(char);
    const narrow = /[IL1.]/.test(char);
    const factor = wide ? 0.8 : narrow ? 0.3 : 0.6;
    return {
      width: Math.max(1, Math.round(fontPx * factor)),
      height: Math.max(1, Math.round(fontPx * 0.72)),
      top: Math.round(fontPx * 0.14),
      left: Math.round(fontPx * 0.04),
    };
  }
}
