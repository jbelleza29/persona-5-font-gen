import { downloadBlob, ensureExt } from './util';

export function downloadSvg(svg: string, filename = 'persona5'): void {
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, ensureExt(filename, 'svg'));
}
