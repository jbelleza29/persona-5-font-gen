import { svgToPngBlob, RasterizeOptions } from './rasterize';

export function clipboardImageSupported(): boolean {
  return (
    typeof ClipboardItem !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    window.isSecureContext
  );
}

export async function copyPng(svg: string, opts: RasterizeOptions): Promise<void> {
  if (!clipboardImageSupported()) {
    throw new Error('Clipboard image copy is not supported (needs a secure context).');
  }
  const blob = await svgToPngBlob(svg, opts);
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}
