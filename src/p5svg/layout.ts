import {
  CharMode,
  Colors,
  LayoutResult,
  PlacedGlyph,
  ResolvedOptions,
} from './types';
import { GlyphMetricsProvider, GlyphSize } from './metrics';
import { randomOp, Rng } from './rng';

const BORDER_SCALE = 1.4; // FIRST glyph outer box
const BACKGROUND_SCALE = 1.2; // other glyphs' box
const RED_RANGE = 5; // at most one red letter per window of 5
const FIRST_BG_SCALE = 0.85; // red inner box on the first glyph
const MERGE_ADVANCE = 0.7; // box advance fraction in merge mode (overlap so boxes fuse)

interface CharSpec {
  isSpace: boolean;
  char: string;
  mode: CharMode;
  angle: number; // final per-char angle
  scale: number;
  fontSize: number;
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

function pickRedModes(chars: string[], rng: Rng): CharMode[] {
  const modes = chars.map(() => CharMode.WHITE);
  modes[0] = CharMode.FIRST;
  for (let i = 1; i < chars.length; i += RED_RANGE) {
    for (let j = i; j < i + RED_RANGE - 1 && j < chars.length; ++j) {
      if (rng() * 10 > 6) {
        modes[j] = CharMode.RED;
        break;
      }
    }
  }
  return modes;
}

function buildSpec(
  char: string,
  mode: CharMode,
  opts: ResolvedOptions,
  metrics: GlyphMetricsProvider,
  rng: Rng,
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

  const fontSize = opts.fontSize * scale;
  const color = mode === CharMode.RED ? Colors.RED : Colors.WHITE;
  const size = metrics.measure(char, fontSize, opts.fontFamily, 'bold');
  const rot = rotatedBox(size.width, size.height, angle);
  const outter = mode === CharMode.FIRST ? BORDER_SCALE : BACKGROUND_SCALE;

  return {
    isSpace: false,
    char,
    mode,
    angle,
    scale,
    fontSize,
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
  const modes = pickRedModes(chars, rng);

  const specs: CharSpec[] = chars.map((char, i) => {
    if (/^\s$/.test(char)) {
      return {
        isSpace: true,
        char: '',
        mode: CharMode.SPACE,
        angle: 0,
        scale: 1,
        fontSize: 0,
        color: 'none',
        size: { width: 0, height: 0, left: 0, ascent: 0, descent: 0 },
        outterWidth: 0,
        outterHeight: 0,
      };
    }
    return buildSpec(char, modes[i], opts, metrics, rng);
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
  for (const s of specs) {
    if (s.isSpace) {
      glyphs.push({
        char: ' ',
        mode: CharMode.SPACE,
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

    const glyph: PlacedGlyph = {
      char: s.char,
      mode: s.mode,
      angle: s.angle,
      scale: s.scale,
      outterWidth: ow,
      outterHeight: oh,
      cx,
      cy,
      rects: [],
      text: {
        x: textX,
        y: textY,
        fontSize: s.fontSize,
        fill: s.color,
        angle: s.angle,
        char: s.char,
      },
    };

    if (s.mode === CharMode.FIRST) {
      glyph.rects.push({
        x: offset,
        y: (height - oh) / 2,
        width: ow,
        height: oh,
        fill: Colors.BLACK,
        angle: s.angle - 5,
        role: 'box',
      });
      const bw = ow * FIRST_BG_SCALE;
      const bh = oh * FIRST_BG_SCALE;
      glyph.rects.push({
        x: offset + (ow - bw) / 2,
        y: (height - bh) / 2,
        width: bw,
        height: bh,
        fill: Colors.RED,
        angle: s.angle - 2,
        role: 'accent',
      });
    } else {
      glyph.rects.push({
        x: offset,
        y: (height - oh) / 2,
        width: ow,
        height: oh,
        fill: Colors.BLACK,
        angle: s.angle + 1,
        role: 'box',
      });
    }

    glyphs.push(glyph);
    maxRight = Math.max(maxRight, offset + ow);
    // Merge mode overlaps boxes so they fuse into one connected shape.
    offset += opts.mergeBoxes ? ow * MERGE_ADVANCE : ow + gutter;
  }

  const width = maxRight + padding;
  return { width, height, glyphs };
}
