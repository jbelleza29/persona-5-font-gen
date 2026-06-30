import { useEffect, useMemo, useRef, useState } from 'react';
import Controls, { ControlsState } from './components/Controls';
import SvgPreview from './components/SvgPreview';
import { generateP5Svg, EmptyTextError, DEFAULTS } from './p5svg';
import { CanvasMetricsProvider } from './p5svg/metrics';
import { loadEmbeddedFont, EmbeddedFont } from './p5svg/fontEmbed';
import { downloadSvg, downloadPng, copyPng } from './export';

// Prototype: mix three families across the letters.
const FONTS = [
  { family: 'P5Times', url: '/fonts/Tinos-Bold.woff2' }, // Times New Roman
  { family: 'P5Heavy', url: '/fonts/ArchivoBlack-Regular.woff2' }, // heavy slot (was Bevan/Cooper stand-in)
  { family: 'P5Avant', url: '/fonts/Jost-Bold.woff2' }, // ITC Avant Garde Gothic
];
const FONT_FAMILIES = FONTS.map((f) => f.family);

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
    pngScale: 2,
  });
  const [seed, setSeed] = useState(randomSeed);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fontsRef = useRef<EmbeddedFont[]>([]);
  const metricsRef = useRef<CanvasMetricsProvider | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fonts = await Promise.all(FONTS.map((f) => loadEmbeddedFont(f.url, f.family)));
      if (typeof FontFace !== 'undefined') {
        await Promise.all(
          fonts.map(async (font) => {
            const face = new FontFace(font.family, `url(${font.dataUrl})`, { weight: '700' });
            await face.load();
            document.fonts.add(face);
          }),
        );
        await document.fonts.ready;
      }
      if (cancelled) return;
      fontsRef.current = fonts;
      metricsRef.current = new CanvasMetricsProvider();
      setReady(true);
    })().catch((e) => setError(`Failed to load fonts: ${String(e)}`));
    return () => {
      cancelled = true;
    };
  }, []);

  const result = useMemo(() => {
    if (!ready || !metricsRef.current || !fontsRef.current.length) return null;
    if (!state.text.trim()) return null;
    try {
      const fontFaceCss = fontsRef.current.map((f) => f.fontFaceCss).join('');
      return generateP5Svg(
        state.text,
        {
          seed,
          fontSize: state.fontSize,
          fontFamily: FONT_FAMILIES[0],
          fontFamilies: FONT_FAMILIES,
          background: {
            fill: state.fillEnabled ? state.fillColor : undefined,
            burst: state.burst,
          },
          outline: { enabled: state.outline },
        },
        { metrics: metricsRef.current, fontFaceCss },
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
  ]);

  const onChange = <K extends keyof ControlsState>(key: K, value: ControlsState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  };

  const rasterOpts = () => ({
    width: result!.width,
    height: result!.height,
    scale: state.pngScale,
    fonts: fontsRef.current.map((f) => ({ family: f.family, dataUrl: f.dataUrl })),
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
