import { useEffect, useMemo, useRef, useState } from 'react';
import Controls, { ControlsState } from './components/Controls';
import SvgPreview from './components/SvgPreview';
import { generateP5Svg, EmptyTextError, DEFAULTS } from './p5svg';
import { CanvasMetricsProvider } from './p5svg/metrics';
import { loadEmbeddedFonts, EmbeddedFontSet } from './p5svg/fontEmbed';
import { downloadSvg, downloadPng, copyPng } from './export';

function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export default function App() {
  const [state, setState] = useState<ControlsState>({
    text: 'PERSONA',
    fontSize: 64,
    fillEnabled: false,
    fillColor: '#e5191c',
    burst: false,
    mergeBoxes: true,
    mergeOverlap: 0.02,
    pngScale: 2,
  });
  const [seed, setSeed] = useState(randomSeed);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fontSetRef = useRef<EmbeddedFontSet | null>(null);
  const metricsRef = useRef<CanvasMetricsProvider | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fontSet = await loadEmbeddedFonts();
      if (typeof FontFace !== 'undefined') {
        await Promise.all(
          fontSet.faces.map(async (f) => {
            const face = new FontFace(f.family, `url(${f.dataUrl})`);
            await face.load();
            document.fonts.add(face);
          }),
        );
        await document.fonts.ready;
      }
      if (cancelled) return;
      fontSetRef.current = fontSet;
      metricsRef.current = new CanvasMetricsProvider();
      setReady(true);
    })().catch((e) => setError(`Failed to load fonts: ${String(e)}`));
    return () => {
      cancelled = true;
    };
  }, []);

  const result = useMemo(() => {
    if (!ready || !metricsRef.current || !fontSetRef.current) return null;
    if (!state.text.trim()) return null;
    try {
      return generateP5Svg(
        state.text,
        {
          seed,
          fontSize: state.fontSize,
          fonts: fontSetRef.current.families,
          heavyFonts: fontSetRef.current.heavyFamilies,
          background: {
            fill: state.fillEnabled ? state.fillColor : undefined,
            burst: state.burst,
          },
          mergeBoxes: state.mergeBoxes,
          mergeOverlap: state.mergeOverlap,
        },
        { metrics: metricsRef.current, fontFaceCss: fontSetRef.current.fontFaceCss },
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
    fonts: fontSetRef.current?.faces,
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

      {!ready && <p className="app__status">Loading fonts…</p>}
      {error && <p className="app__error">{error}</p>}
    </div>
  );
}
