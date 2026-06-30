import { Colors, LayoutResult, ResolvedOptions } from './types';

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
  if (opts.outline.enabled) {
    defs.push(
      `<filter id="paperEdge" x="-20%" y="-20%" width="140%" height="140%">` +
        `<feMorphology in="SourceAlpha" operator="dilate" radius="${n(
          opts.outline.radius,
        )}" result="d"/>` +
        `<feFlood flood-color="${safeColor(opts.outline.color, Colors.WHITE)}" result="f"/>` +
        `<feComposite in="f" in2="d" operator="in" result="edge"/>` +
        `<feMerge><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge>` +
        `</filter>`,
    );
  }
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

  const filterAttr = opts.outline.enabled ? ' filter="url(#paperEdge)"' : '';
  parts.push(`<g id="glyphs"${filterAttr}>`);
  for (const g of glyphs) {
    const pivot = `${n(g.cx)} ${n(g.cy)}`;
    for (const r of g.rects) {
      parts.push(
        `<rect x="${n(r.x)}" y="${n(r.y)}" width="${n(r.width)}" height="${n(
          r.height,
        )}" fill="${r.fill}" transform="rotate(${n(r.angle)} ${pivot})"/>`,
      );
    }
    if (g.text) {
      const t = g.text;
      parts.push(
        `<text x="${n(t.x)}" y="${n(t.y)}" font-family="${opts.fontFamily}" font-weight="700" font-size="${n(
          t.fontSize,
        )}" fill="${t.fill}" dominant-baseline="text-before-edge" text-anchor="start" transform="rotate(${n(
          t.angle,
        )} ${pivot})">${esc(t.char)}</text>`,
      );
    }
  }
  parts.push('</g>');
  parts.push('</svg>');
  return parts.join('');
}
