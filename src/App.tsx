import { useEffect, useMemo, useRef, useState } from 'react';
import Controls, { ControlsState } from './components/Controls';
import SvgPreview from './components/SvgPreview';
import { generateP5Svg, EmptyTextError, DEFAULTS } from './p5svg';
import { CanvasMetricsProvider } from './p5svg/metrics';
import { loadEmbeddedFont, EmbeddedFont } from './p5svg/fontEmbed';
import { downloadSvg, downloadPng, copyPng } from './export';

const FONT_FAMILY = 'P5Display';
const FONT_URL = '/fonts/Anton-Regular.woff2';

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export default function App() {
  const [state, setState] = useState<ControlsState>({
    text: 'TAKE YOUR HEART',
    fontSize: 64,
    fillEnabled: false,
    fillColor: '#e5191c',
    burst: false,
    outline: false,
    mergeBoxes: false,
    mergeOverlap: 0.2,
    pngScale: 2,
  });
  const [seed, setSeed] = useState(randomSeed);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fontRef = useRef<EmbeddedFont | null>(null);
  const metricsRef = useRef<CanvasMetricsProvider | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const font = await loadEmbeddedFont(FONT_URL, FONT_FAMILY);
      if (typeof FontFace !== 'undefined') {
        const face = new FontFace(FONT_FAMILY, `url(${font.dataUrl})`, { weight: '700' });
        await face.load();
        document.fonts.add(face);
        await document.fonts.ready;
      }
      if (cancelled) return;
      fontRef.current = font;
      metricsRef.current = new CanvasMetricsProvider();
      setReady(true);
    })().catch((e) => setError(`Failed to load font: ${String(e)}`));
    return () => {
      cancelled = true;
    };
  }, []);

  const result = useMemo(() => {
    if (!ready || !metricsRef.current || !fontRef.current) return null;
    if (!state.text.trim()) return null;
    try {
      return generateP5Svg(
        state.text,
        {
          seed,
          fontSize: state.fontSize,
          fontFamily: FONT_FAMILY,
          background: {
            fill: state.fillEnabled ? state.fillColor : undefined,
            burst: state.burst,
          },
          outline: { enabled: state.outline },
          mergeBoxes: state.mergeBoxes,
          mergeOverlap: state.mergeOverlap,
        },
        { metrics: metricsRef.current, fontFaceCss: fontRef.current.fontFaceCss },
      );
    } catch (e) {
      if (e instanceof EmptyTextError) return null;
      throw e;
    }
  }, [
    ready,
    seed,
    state.text,
    state.fontSize,
    state.fillEnabled,
    state.fillColor,
    state.burst,
    state.outline,
    state.mergeBoxes,
    state.mergeOverlap,
  ]);

  const onChange = <K extends keyof ControlsState>(key: K, value: ControlsState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const rasterOpts = () => ({
    width: result!.width,
    height: result!.height,
    scale: state.pngScale,
    fontFamily: FONT_FAMILY,
    fontDataUrl: fontRef.current?.dataUrl,
  });

  const runExport = async (fn: () => void | Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const fileBase = state.text.trim().slice(0, 24) || 'persona5';

  return (
    <div className="app">
      <header className="app__header">
        <h1>Persona 5 Text Generator</h1>
        <p>SVG calling-card text. Transparent by default — add a background or outline if you want.</p>
      </header>

      <main className="app__main">
        <SvgPreview svg={result?.svg ?? null} />
        <Controls
          {...state}
          maxChars={DEFAULTS.maxChars}
          canExport={!!result}
          busy={busy}
          onChange={onChange}
          onReroll={() => setSeed(randomSeed())}
          onDownloadSvg={() => result && downloadSvg(result.svg, fileBase)}
          onDownloadPng={() => result && runExport(() => downloadPng(result.svg, fileBase, rasterOpts()))}
          onCopyPng={() => result && runExport(() => copyPng(result.svg, rasterOpts()))}
        />
      </main>

      {!ready && <p className="app__status">Loading font…</p>}
      {error && <p className="app__error">{error}</p>}
    </div>
  );
}
