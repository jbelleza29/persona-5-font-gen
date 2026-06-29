export const Colors = {
  RED: '#E5191C',
  WHITE: '#FDFDFD',
  BLACK: '#0F0F0F',
} as const;

export enum CharMode {
  FIRST = 'first',
  WHITE = 'white',
  RED = 'red',
  /** Black letter on a white box with a black border. */
  INVERT = 'invert',
  SPACE = 'space',
}

export interface Background {
  /** Solid fill color (any CSS color). Omit for no fill. */
  fill?: string;
  /** Concentric red/black "burst" rings behind the glyphs. */
  burst?: boolean;
}

export interface Outline {
  enabled: boolean;
  color?: string;
  radius?: number;
}

export interface Options {
  fontSize?: number;
  gutter?: number;
  padding?: number;
  seed?: number;
  maxChars?: number;
  fontFamily?: string;
  /** Font families to swap between per letter (P5 ransom-note look). */
  fonts?: string[];
  /** Thicker subset used for inverted (black-on-white) letters; defaults to `fonts`. */
  heavyFonts?: string[];
  background?: Background;
  outline?: Outline;
  /** Widen the black boxes so they overlap into one fused shape behind the letters. */
  mergeBoxes?: boolean;
  /** Extra black-box width as a fraction of the box, in merge mode (more = more fusion). */
  mergeOverlap?: number;
}

export interface ResolvedOptions {
  fontSize: number;
  gutter: number;
  padding: number;
  maxChars: number;
  fontFamily: string;
  fonts: string[];
  heavyFonts: string[];
  background: Background;
  outline: Required<Outline>;
  mergeBoxes: boolean;
  mergeOverlap: number;
}

export const DEFAULTS: ResolvedOptions = {
  fontSize: 60,
  gutter: 5,
  padding: 30,
  maxChars: 30,
  fontFamily: 'P5Display',
  fonts: ['P5Display'],
  heavyFonts: ['P5Display'],
  background: {},
  outline: { enabled: false, color: Colors.WHITE, radius: 3 },
  mergeBoxes: false,
  mergeOverlap: 0.2,
};

export function resolveOptions(options: Options = {}): ResolvedOptions {
  const fontFamily = options.fontFamily ?? DEFAULTS.fontFamily;
  return {
    fontSize: options.fontSize ?? DEFAULTS.fontSize,
    gutter: options.gutter ?? DEFAULTS.gutter,
    padding: options.padding ?? DEFAULTS.padding,
    maxChars: options.maxChars ?? DEFAULTS.maxChars,
    fontFamily,
    fonts: options.fonts && options.fonts.length > 0 ? options.fonts : [fontFamily],
    heavyFonts:
      options.heavyFonts && options.heavyFonts.length > 0
        ? options.heavyFonts
        : options.fonts && options.fonts.length > 0
          ? options.fonts
          : [fontFamily],
    background: { ...DEFAULTS.background, ...options.background },
    outline: { ...DEFAULTS.outline, ...options.outline },
    mergeBoxes: options.mergeBoxes ?? DEFAULTS.mergeBoxes,
    mergeOverlap: options.mergeOverlap ?? DEFAULTS.mergeOverlap,
  };
}

export interface TextLayer {
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  /** Letter fill color. */
  fill: string;
  /** Thick silhouette that traces the letter (the "box" replacement). */
  outlineColor: string;
  /** Outer paper edge color (drawn when outline is enabled). */
  edgeColor: string;
  angle: number;
  char: string;
}

export interface PlacedGlyph {
  char: string;
  mode: CharMode;
  /** Base per-char angle. */
  angle: number;
  scale: number;
  outterWidth: number;
  outterHeight: number;
  /** Rotation pivot for the letter. */
  cx: number;
  cy: number;
  text: TextLayer | null;
}

export interface LayoutResult {
  width: number;
  height: number;
  glyphs: PlacedGlyph[];
}
