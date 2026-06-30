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
 * Canvas-backed metrics. Renders the glyph with textBaseline 'top' and scans the
 * pixels for the ink bounding box (same approach as the reference). top/left are
 * the ink offsets from the em-box top-left, which pairs with the SVG renderer's
 * dominant-baseline="text-before-edge".
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
    const pad = Math.ceil(fontPx * 0.5);
    const w = Math.ceil(fontPx * 2) + pad;
    const h = Math.ceil(fontPx * 2) + pad;
    ctx.canvas.width = w;
    ctx.canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${weight} ${fontPx}px ${fontFamily}`;
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000';
    ctx.fillText(char, 0, 0);

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
      return { width: Math.max(1, adv), height: fontPx, top: 0, left: 0 };
    }

    return {
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      top: minY,
      left: minX,
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
