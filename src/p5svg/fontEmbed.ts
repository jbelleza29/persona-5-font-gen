export interface EmbeddedFont {
  family: string;
  /** woff2 as a data: URL (for embedding + FontFace warming). */
  dataUrl: string;
  /** Ready-to-inject @font-face rule referencing the data URL. */
  fontFaceCss: string;
}

function base64FromBuffer(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Browser-only: fetch the bundled woff2 and build a self-contained @font-face. */
export async function loadEmbeddedFont(
  url = '/fonts/Anton-Regular.woff2',
  family = 'P5Display',
): Promise<EmbeddedFont> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load font (${res.status})`);
  const buf = await res.arrayBuffer();
  const dataUrl = `data:font/woff2;base64,${base64FromBuffer(buf)}`;
  const fontFaceCss = `@font-face{font-family:'${family}';font-weight:700;font-style:normal;src:url(${dataUrl}) format('woff2');}`;
  return { family, dataUrl, fontFaceCss };
}
