export interface RasterizeOptions {
  width: number;
  height: number;
  scale?: number;
  /** Warm this font in the document before rasterizing (WebKit bug 219770). */
  fontFamily?: string;
  fontDataUrl?: string;
}

async function warmFont(family?: string, dataUrl?: string): Promise<void> {
  if (!family || !dataUrl || typeof FontFace === 'undefined' || !('fonts' in document)) {
    return;
  }
  try {
    const face = new FontFace(family, `url(${dataUrl})`, { weight: '700' });
    await face.load();
    document.fonts.add(face);
    await document.fonts.ready;
  } catch {
    // best effort; fall through to plain rasterization
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const done = async () => {
      if (typeof img.decode === 'function') {
        try {
          await img.decode();
        } catch {
          /* ignore decode failure, pixels are still drawable */
        }
      }
      resolve(img);
    };
    img.onload = () => void done();
    img.onerror = () => reject(new Error('SVG image failed to load'));
    img.src = url;
  });
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob returned null'))),
      'image/png',
    );
  });
}

/** Rasterize a self-contained SVG string to a transparent PNG blob. */
export async function svgToPngBlob(svg: string, opts: RasterizeOptions): Promise<Blob> {
  const scale = opts.scale ?? 1;
  await warmFont(opts.fontFamily, opts.fontDataUrl);

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImage(url);
    // Give WebKit a frame so the embedded @font-face applies before drawing.
    await new Promise((r) => setTimeout(r, 30));

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(opts.width * scale));
    canvas.height = Math.max(1, Math.round(opts.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    // No fillRect: leave the canvas transparent so alpha is preserved.
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await canvasToPng(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}
