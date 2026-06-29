import { svgToPngBlob, RasterizeOptions } from './rasterize';
import { downloadBlob, ensureExt } from './util';

export async function downloadPng(
  svg: string,
  filename: string,
  opts: RasterizeOptions,
): Promise<void> {
  const blob = await svgToPngBlob(svg, opts);
  downloadBlob(blob, ensureExt(filename, 'png'));
}
