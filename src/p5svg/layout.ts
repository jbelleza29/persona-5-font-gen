import {
  CharMode,
  Colors,
  LayoutResult,
  PlacedGlyph,
  RectLayer,
  ResolvedOptions,
} from './types';
import { GlyphMetricsProvider, GlyphSize } from './metrics';
import { randomOp, Rng } from './rng';

const BORDER_SCALE = 1.4; // FIRST glyph outer box
const BACKGROUND_SCALE = 1.2; // other glyphs' slot
const RED_RANGE = 5; // at most one red letter per window of 5
const THIN_PROB = 0.33; // chance a letter is "thin" when allowed (baseline leans thick)
const VOWELS = /[AEIOU]/; // P5 drops middle vowels to lowercase
const CONSONANT_LOWER_PROB = 0.15; // occasional lowercase consonant for ransom variation
const INNER_SCALE = 0.85; // white inner panel size for inverted box letters
const TRACK = 0.84; // advance per letter as a fraction of its slot (lower = more crowded)

interface CharSpec {
  isSpace: boolean;
  char: string;
  mode: CharMode;
  angle: number; // final per-char angle
  scale: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  size: GlyphSize;
  outterWidth: number;
  outterHeight: number;
}

function rotatedBox(width: number, height: number, angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(a));
  const cos = Math.abs(Math.cos(a));
  return {
    width: Math.ceil(width * cos) + Math.ceil(height * sin),
    height: Math.ceil(height * cos) + Math.ceil(width * sin),
  };
}

function pickAccentModes(chars: string[], rng: Rng): CharMode[] {
  const modes = chars.map(() => CharMode.WHITE);
  modes[0] = CharMode.FIRST;
  for (let i = 1; i < chars.length; i += RED_RANGE) {
    for (let j = i; j < i + RED_RANGE - 1 && j < chars.length; ++j) {
      if (rng() * 10 > 6) {
        modes[j] = CharMode.INVERT;
        break;
      }
    }
  }
  return modes;
}

/**
 * Decide a thickness tier (thin/thick) per letter. Thick-biased baseline, and
 * a thin letter is never followed by another thin one (thick -> thin -> thick).
 * FIRST and INVERT letters are always thick. Spaces are skipped (don't break the run).
 */
function pickThickness(chars: string[], modes: CharMode[], rng: Rng): boolean[] {
  const thin = chars.map(() => false);
  let prevThin = false;
  for (let i = 0; i < chars.length; i++) {
    if (/^\s$/.test(chars[i])) continue;
    const mode = modes[i];
    let isThin: boolean;
    if (mode === CharMode.FIRST || mode === CharMode.INVERT || prevThin) {
      isThin = false;
    } else {
      isThin = rng() < THIN_PROB;
    }
    thin[i] = isThin;
    prevThin = isThin;
  }
  return thin;
}

/** Pick a font per letter from the matching thickness pool, avoiding an immediate repeat. */
function pickFonts(chars: string[], thin: boolean[], thickFonts: string[], thinFonts: string[], rng: Rng): string[] {
  const fonts = chars.map(() => '');
  let prev = '';
  for (let i = 0; i < chars.length; i++) {
    if (/^\s$/.test(chars[i])) continue;
    const pool = thin[i] ? thinFonts : thickFonts;
    const choices = pool.length > 1 ? pool.filter((f) => f !== prev) : pool;
    const fam = choices[Math.floor(rng() * choices.length)] ?? pool[0];
    fonts[i] = fam;
    prev = fam;
  }
  return fonts;
}

function buildSpec(
  char: string,
  mode: CharMode,
  opts: ResolvedOptions,
  metrics: GlyphMetricsProvider,
  rng: Rng,
  fontFamily: string,
  isEdge: boolean,
): CharSpec {
  // rng call order mirrors the reference BoxChar constructor.
  const base = -(Math.round(rng() * 10) % 10);
  let scale: number;
  let angle: number;
  if (mode === CharMode.FIRST) {
    scale = 1.1;
    angle = base;
  } else {
    scale = 1 - ((Math.floor(rng() * 10) % 3) / 10);
    angle = base * randomOp(rng);
  }

  // P5 case rule: edges stay uppercase; middle vowels drop to lowercase; consonants
  // stay uppercase apart from the occasional ransom-note exception.
  let lower: boolean;
  if (isEdge) {
    lower = false;
  } else if (VOWELS.test(char)) {
    lower = true;
  } else {
    lower = rng() < CONSONANT_LOWER_PROB;
  }
  const display = lower ? char.toLowerCase() : char;

  const fontSize = opts.fontSize * scale;
  const color = mode === CharMode.INVERT ? Colors.BLACK : Colors.WHITE;
  const size = metrics.measure(display, fontSize, fontFamily, 'normal');
  const rot = rotatedBox(size.width, size.height, angle);
  const outter = mode === CharMode.FIRST ? BORDER_SCALE : BACKGROUND_SCALE;

  return {
    isSpace: false,
    char: display,
    mode,
    angle,
    scale,
    fontSize,
    fontFamily,
    color,
    size,
    outterWidth: rot.width * outter,
    outterHeight: rot.height * outter,
  };
}

export function computeLayout(
  text: string,
  opts: ResolvedOptions,
  metrics: GlyphMetricsProvider,
  rng: Rng,
): LayoutResult {
  const chars = Array.from(text.trim().toUpperCase()).slice(0, opts.maxChars);
  const modes = pickAccentModes(chars, rng);
  const thin = pickThickness(chars, modes, rng);

  // thick pool = heavy faces; thin pool = the rest (fall back to all if a side is empty)
  const thickFonts = opts.heavyFonts.length > 0 ? opts.heavyFonts : opts.fonts;
  const thinCandidates = opts.fonts.filter((f) => !opts.heavyFonts.includes(f));
  const thinFonts = thinCandidates.length > 0 ? thinCandidates : opts.fonts;
  const fontByIndex = pickFonts(chars, thin, thickFonts, thinFonts, rng);

  // Leading and trailing letters are the edges (contour style + always uppercase).
  let firstIdx = -1;
  let lastIdx = -1;
  for (let i = 0; i < chars.length; i++) {
    if (!/^\s$/.test(chars[i])) {
      if (firstIdx < 0) firstIdx = i;
      lastIdx = i;
    }
  }

  const specs: CharSpec[] = chars.map((char, i) => {
    if (/^\s$/.test(char)) {
      return {
        isSpace: true,
        char: '',
        mode: CharMode.SPACE,
        angle: 0,
        scale: 1,
        fontSize: 0,
        fontFamily: '',
        color: 'none',
        size: { width: 0, height: 0, left: 0, ascent: 0, descent: 0 },
        outterWidth: 0,
        outterHeight: 0,
      };
    }
    return buildSpec(char, modes[i], opts, metrics, rng, fontByIndex[i], i === firstIdx || i === lastIdx);
  });

  const { gutter, padding } = opts;
  let contentHeight = 0;
  for (const s of specs) {
    if (!s.isSpace) contentHeight = Math.max(contentHeight, s.outterHeight);
  }
  const height = contentHeight + padding * 2;

  const glyphs: PlacedGlyph[] = [];
  let offset = padding;
  let maxRight = padding;
  for (let i = 0; i < specs.length; i++) {
    const s = specs[i];
    if (s.isSpace) {
      glyphs.push({
        char: ' ',
        mode: CharMode.SPACE,
        style: 'box',
        angle: 0,
        scale: 1,
        outterWidth: 0,
        outterHeight: 0,
        cx: offset,
        cy: padding,
        rects: [],
        text: null,
      });
      offset += 2 * gutter;
      maxRight = Math.max(maxRight, offset);
      continue;
    }

    const ow = s.outterWidth;
    const oh = s.outterHeight;
    const cx = offset + ow / 2;
    const cy = padding + oh / 2;
    const textX = offset + (ow - s.size.width) / 2 - s.size.left;
    // baseline y so the ink box is centered vertically in the canvas
    const textY = height / 2 + (s.size.ascent - s.size.descent) / 2;
    const style: 'box' | 'contour' = i === firstIdx || i === lastIdx ? 'contour' : 'box';
    // Contour (edge) letters are always white with a black contour; never inverted.
    const fill = style === 'contour' ? Colors.WHITE : s.color;

    const rects: RectLayer[] = [];
    let rightEdge = offset + ow;
    if (style === 'box') {
      // Merge mode widens the black box so neighbors fuse; letters keep their spot.
      const extend = opts.mergeBoxes ? gutter + ow * opts.mergeOverlap : 0;
      const boxX = offset - extend / 2;
      const boxW = ow + extend;
      rects.push({
        x: boxX,
        y: (height - oh) / 2,
        width: boxW,
        height: oh,
        fill: Colors.BLACK,
        angle: s.angle + 1,
        role: 'box',
      });
      if (s.mode === CharMode.INVERT) {
        const iw = ow * INNER_SCALE;
        const ih = oh * INNER_SCALE;
        rects.push({
          x: offset + (ow - iw) / 2,
          y: (height - ih) / 2,
          width: iw,
          height: ih,
          fill: Colors.WHITE,
          angle: s.angle,
          role: 'inner',
        });
      }
      rightEdge = boxX + boxW;
    }

    glyphs.push({
      char: s.char,
      mode: s.mode,
      style,
      angle: s.angle,
      scale: s.scale,
      outterWidth: ow,
      outterHeight: oh,
      cx,
      cy,
      rects,
      text: {
        x: textX,
        y: textY,
        fontSize: s.fontSize,
        fontFamily: s.fontFamily,
        fill,
        angle: s.angle,
        char: s.char,
      },
    });

    maxRight = Math.max(maxRight, rightEdge);
    offset += ow * TRACK; // crowd letters so boxes/contours overlap and merge
  }

  const width = maxRight + padding;
  return { width, height, glyphs };
}
