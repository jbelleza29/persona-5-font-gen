import { computeLayout } from './layout';
import { GlyphMetricsProvider } from './metrics';
import { renderSvg } from './render';
import { mulberry32, Rng } from './rng';
import { Options, resolveOptions } from './types';

export class EmptyTextError extends Error {
  constructor(message = 'Text must not be empty') {
    super(message);
    this.name = 'EmptyTextError';
  }
}

export interface GenerateDeps {
  metrics: GlyphMetricsProvider;
  /** @font-face CSS injected into the SVG <defs> (keeps the core pure/testable). */
  fontFaceCss: string;
  /** Optional RNG override; otherwise derived from options.seed. */
  rng?: Rng;
}

export interface GenerateResult {
  svg: string;
  width: number;
  height: number;
}

/** Pure: no DOM or network access. Throws EmptyTextError on blank input. */
export function generateP5Svg(
  text: string,
  options: Options,
  deps: GenerateDeps,
): GenerateResult {
  if (!text || !text.trim()) throw new EmptyTextError();
  const opts = resolveOptions(options);
  const seed = options.seed ?? ((Math.random() * 0xffffffff) >>> 0);
  const rng: Rng = deps.rng ?? mulberry32(seed);
  const layout = computeLayout(text, opts, deps.metrics, rng);
  const svg = renderSvg(layout, opts, deps.fontFaceCss);
  return { svg, width: layout.width, height: layout.height };
}

export * from './types';
export * from './rng';
export * from './metrics';
export * from './fontEmbed';
export { computeLayout } from './layout';
export { renderSvg } from './render';
