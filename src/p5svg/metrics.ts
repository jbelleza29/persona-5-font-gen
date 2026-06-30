export interface GlyphSize {
  width: number;
  height: number;
  /** Ink left offset from the pen x (left side bearing). */
  left: number;
  /** Ink top distance above the alphabetic baseline. */
  ascent: number;
  /** Ink bottom distance below the alphabetic baseline. */
  descent: number;
}

export interface GlyphMetricsProvider {
  measure(char: string, fontPx: number, fontFamily: string, weight: string): GlyphSize;
}

/**
 * Canvas-backed metrics. Renders the glyph on the alphabetic baseline and scans
 * the pixels for the ink bounding box. Returning ascent/descent relative to the
 * alphabetic baseline lets the SVG renderer place text by that same baseline,
 * which canvas and SVG define identically (so centering is exact).
 */
export class CanvasMetricsProvider implements GlyphMetricsProvider {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas?: HTMLCanvasElement) {
    const c = canvas ?? document.createElement('canvas');
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  measure(char: string, fontPx: number, fontFamily: string, weight: string): GlyphSize {
    const ctx = this.ctx;
    const pad = Math.ceil(fontPx * 0.6);
    const w = Math.ceil(fontPx * 2) + pad * 2;
    const h = Math.ceil(fontPx * 2) + pad * 2;
    const penX = pad;
    const penY = Math.ceil(fontPx * 1.4);
    ctx.canvas.width = w;
    ctx.canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${weight} ${fontPx}px ${fontFamily}`;
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#000';
    ctx.fillText(char, penX, penY);

    const data = ctx.getImageData(0, 0, w, h).data;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] !== 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < 0) {
      // No ink (e.g. unsupported glyph) — fall back to advance width.
      const adv = ctx.measureText(char).width || fontPx * 0.4;
      return { width: Math.max(1, adv), height: fontPx, left: 0, ascent: fontPx * 0.7, descent: 0 };
    }

    return {
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      left: minX - penX,
      ascent: penY - minY,
      descent: maxY - penY,
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
    const ascent = Math.round(fontPx * 0.72);
    return {
      width: Math.max(1, Math.round(fontPx * factor)),
      height: ascent,
      left: Math.round(fontPx * 0.04),
      ascent,
      descent: 0,
    };
  }
}
