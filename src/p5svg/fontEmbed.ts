export interface BundledFont {
  /** SVG/CSS family alias (single word, no spaces). */
  family: string;
  url: string;
  /** Thick-stroke face — used for inverted (black-on-white) letters so they don't read thin. */
  heavy?: boolean;
}

/**
 * A spread of heavy display faces. P5's ransom-note look comes from swapping
 * fonts per letter, so we bundle several and let the layout pick one per glyph.
 */
export const DEFAULT_FONT_SET: BundledFont[] = [
  { family: 'P5Anton', url: '/fonts/Anton-Regular.woff2', heavy: true }, // condensed sans
  { family: 'P5Archivo', url: '/fonts/ArchivoBlack-Regular.woff2', heavy: true }, // heavy grotesque
  { family: 'P5Bevan', url: '/fonts/Bevan-Regular.woff2', heavy: true }, // slab serif
  { family: 'P5Tinos', url: '/fonts/Tinos-Bold.woff2' }, // times-style serif (thinner)
  { family: 'P5Jost', url: '/fonts/Jost-Bold.woff2' }, // geometric (thinner)
];

export interface EmbeddedFontFace {
  family: string;
  /** woff2 as a data: URL (for embedding + FontFace warming). */
  dataUrl: string;
}

export interface EmbeddedFontSet {
  /** @font-face rules for every family, ready to inject into an SVG <defs>. */
  fontFaceCss: string;
  families: string[];
  /** Subset of families with thick strokes (for inverted letters). */
  heavyFamilies: string[];
  faces: EmbeddedFontFace[];
}

function base64FromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Browser-only: fetch each bundled woff2 and build self-contained @font-face rules. */
export async function loadEmbeddedFonts(set: BundledFont[] = DEFAULT_FONT_SET): Promise<EmbeddedFontSet> {
  const faces = await Promise.all(
    set.map(async (f): Promise<EmbeddedFontFace> => {
      const res = await fetch(f.url);
      if (!res.ok) throw new Error(`Failed to load font ${f.family} (${res.status})`);
      const buf = await res.arrayBuffer();
      return { family: f.family, dataUrl: `data:font/woff2;base64,${base64FromBuffer(buf)}` };
    }),
  );
  const fontFaceCss = faces
    .map(
      (f) =>
        `@font-face{font-family:'${f.family}';font-style:normal;src:url(${f.dataUrl}) format('woff2');}`,
    )
    .join('');
  return {
    fontFaceCss,
    families: faces.map((f) => f.family),
    heavyFamilies: set.filter((f) => f.heavy).map((f) => f.family),
    faces,
  };
}
