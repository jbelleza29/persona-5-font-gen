# Persona 5 Text Generator

Type text, get a Persona 5 "calling card" style graphic as **SVG**. Transparent
background and no outline by default; add a solid color, the concentric red/black
burst, or the white cut-paper outline as you like. Export to SVG, PNG (1x/2x/4x),
or copy to clipboard.

Reimplements the algorithm from [LzxHahaha/persona5](https://github.com/LzxHahaha/persona5)
(canvas-based) as vector SVG.

## Dev

```bash
npm install
npm run dev      # local app
npm run build    # typecheck + production build to dist/
npm test         # vitest unit tests (generator core)
npm run e2e      # playwright browser tests
```

## Layout

- `src/p5svg/` — pure generator core (no DOM): `generateP5Svg(text, options, deps)`
  returns `{ svg, width, height }`. `metrics` and `fontFaceCss` are injected so the
  core is testable in jsdom.
- `src/export/` — SVG / PNG / clipboard, browser only.
- `src/components/`, `src/App.tsx` — UI.

## Fonts

The P5 ransom-note look comes from swapping fonts per letter, so several heavy
display faces are bundled (`public/fonts/`) and the generator picks one per glyph.
License texts ship alongside each font.

| Font | Style | License |
| --- | --- | --- |
| [Anton](https://fonts.google.com/specimen/Anton) | condensed sans | OFL 1.1 (`Anton-OFL.txt`) |
| [Archivo Black](https://fonts.google.com/specimen/Archivo+Black) | heavy grotesque | OFL 1.1 (`ArchivoBlack-OFL.txt`) |
| [Bevan](https://fonts.google.com/specimen/Bevan) | slab serif | OFL 1.1 (`Bevan-OFL.txt`) |
| [Tinos](https://fonts.google.com/specimen/Tinos) | Times-style serif | Apache 2.0 (`Tinos-LICENSE.txt`) |
| [Jost](https://fonts.google.com/specimen/Jost) | geometric (Futura-ish) | OFL 1.1 (`Jost-OFL.txt`) |
