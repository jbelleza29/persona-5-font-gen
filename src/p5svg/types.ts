export const Colors = {
  RED: '#E5191C',
  WHITE: '#FDFDFD',
  BLACK: '#0F0F0F',
} as const;

export enum CharMode {
  FIRST = 'first',
  WHITE = 'white',
  RED = 'red',
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
  /** Pool of font families; each glyph picks one at random. Falls back to [fontFamily]. */
  fontFamilies?: string[];
  background?: Background;
  outline?: Outline;
}

export interface ResolvedOptions {
  fontSize: number;
  gutter: number;
  padding: number;
  maxChars: number;
  fontFamily: string;
  fontFamilies: string[];
  background: Background;
  outline: Required<Outline>;
}

export const DEFAULTS: ResolvedOptions = {
  fontSize: 60,
  gutter: 5,
  padding: 30,
  maxChars: 30,
  fontFamily: 'P5Display',
  fontFamilies: ['P5Display'],
  background: {},
  outline: { enabled: false, color: Colors.WHITE, radius: 3 },
};

export function resolveOptions(options: Options = {}): ResolvedOptions {
  const fontFamily = options.fontFamily ?? DEFAULTS.fontFamily;
  const fontFamilies = options.fontFamilies?.length ? options.fontFamilies : [fontFamily];
  return {
    fontSize: options.fontSize ?? DEFAULTS.fontSize,
    gutter: options.gutter ?? DEFAULTS.gutter,
    padding: options.padding ?? DEFAULTS.padding,
    maxChars: options.maxChars ?? DEFAULTS.maxChars,
    fontFamily,
    fontFamilies,
    background: { ...DEFAULTS.background, ...options.background },
    outline: { ...DEFAULTS.outline, ...options.outline },
  };
}

/** A rotated rectangle layer. All layers of a glyph share one pivot (cx, cy). */
export interface RectLayer {
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  angle: number;
}

export interface TextLayer {
  x: number;
  y: number;
  fontSize: number;
  fill: string;
  angle: number;
  char: string;
  fontFamily: string;
}

export interface PlacedGlyph {
  char: string;
  mode: CharMode;
  /** Base per-char angle before per-layer offsets. */
  angle: number;
  scale: number;
  outterWidth: number;
  outterHeight: number;
  /** Shared rotation pivot reused by every layer of this glyph. */
  cx: number;
  cy: number;
  rects: RectLayer[];
  text: TextLayer | null;
}

export interface LayoutResult {
  width: number;
  height: number;
  glyphs: PlacedGlyph[];
}
