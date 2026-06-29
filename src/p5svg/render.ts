import { Colors, LayoutResult, ResolvedOptions } from './types';

const OUTLINE_FRAC = 0.09; // letter outline thickness as a fraction of font size
const EDGE_FRAC = 0.06; // extra outer paper-edge thickness

function n(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Accept only well-formed CSS colors; reject anything that could break out of
 * the SVG attribute (the markup is injected via dangerouslySetInnerHTML). */
export function safeColor(color: string | undefined, fallback: string | null): string | null {
  if (!color) return fallback;
  const v = color.trim();
  const ok =
    /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(v) ||
    /^[a-z]{1,20}$/i.test(v) ||
    /^(rgb|rgba|hsl|hsla)\([0-9.,%/\sdeg]+\)$/i.test(v);
  return ok ? v : fallback;
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      default:
        return '&quot;';
    }
  });
}

function renderBurst(w: number, h: number): string {
  const step = w / 10;
  const cx = w / 2;
  const cy = h / 2;
  const radii: number[] = [];
  for (let r = step; r < w; r += step) radii.push(r);
  // Largest first so smaller rings paint on top (matches the reference's
  // destination-over stacking). Ring k (1-based) is red when k is odd.
  const circles = radii
    .map((r, i) => ({ r, k: i + 1 }))
    .reverse()
    .map(
      ({ r, k }) =>
        `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${
          k % 2 === 1 ? Colors.RED : Colors.BLACK
        }"/>`,
    )
    .join('');
  return `<g id="bg-burst">${circles}</g>`;
}

export function renderSvg(
  layout: LayoutResult,
  opts: ResolvedOptions,
  fontFaceCss: string,
): string {
  const { width: w, height: h, glyphs } = layout;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="${n(
      w,
    )}" height="${n(h)}">`,
  );

  const defs: string[] = [];
  if (fontFaceCss) defs.push(`<style>${fontFaceCss}</style>`);
  if (defs.length) parts.push(`<defs>${defs.join('')}</defs>`);

  // z-stack: background fill -> burst -> glyphs
  const fill = safeColor(opts.background.fill, null);
  if (fill) {
    parts.push(
      `<rect id="bg-fill" x="0" y="0" width="${n(w)}" height="${n(h)}" fill="${fill}"/>`,
    );
  }
  if (opts.background.burst) {
    parts.push(renderBurst(w, h));
  }

  // Each letter is drawn as a contour silhouette: an outer paper edge (optional),
  // a thick outline that traces the letter, then the letter fill. Drawn in passes
  // so that, when thick enough to touch, outlines fuse cleanly beneath the fills.
  const letters = glyphs.filter((g) => g.text);
  const mergeBoost = opts.mergeBoxes ? opts.mergeOverlap : 0;

  const textLayer = (g: (typeof glyphs)[number], color: string, strokeW: number): string => {
    const t = g.text!;
    const stroke =
      strokeW > 0
        ? ` stroke="${color}" stroke-width="${n(strokeW)}" stroke-linejoin="round" paint-order="stroke"`
        : '';
    return `<text x="${n(t.x)}" y="${n(t.y)}" font-family="${t.fontFamily}" font-size="${n(
      t.fontSize,
    )}" fill="${color}"${stroke} dominant-baseline="alphabetic" text-anchor="start" transform="rotate(${n(
      t.angle,
    )} ${n(g.cx)} ${n(g.cy)})">${esc(t.char)}</text>`;
  };

  parts.push('<g id="glyphs">');
  // pass 1: outer paper edge (only when outline enabled)
  if (opts.outline.enabled) {
    for (const g of letters) {
      const t = g.text!;
      const outline = t.fontSize * (OUTLINE_FRAC + mergeBoost);
      const edge = outline + t.fontSize * EDGE_FRAC;
      parts.push(textLayer(g, safeColor(t.edgeColor, Colors.WHITE)!, 2 * edge));
    }
  }
  // pass 2: thick outline tracing each letter (fuses when merged)
  for (const g of letters) {
    const t = g.text!;
    parts.push(textLayer(g, safeColor(t.outlineColor, Colors.BLACK)!, 2 * t.fontSize * (OUTLINE_FRAC + mergeBoost)));
  }
  // pass 3: the letter itself
  for (const g of letters) {
    parts.push(textLayer(g, safeColor(g.text!.fill, Colors.WHITE)!, 0));
  }
  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('');
}
