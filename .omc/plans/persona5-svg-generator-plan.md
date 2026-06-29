# Persona 5 Style Text Generator — SVG Web App

**Status:** `pending approval`
**Date:** 2026-06-29
**Mode:** Consensus plan (RALPLAN-DR short mode — Planner → Architect → Critic)

---

## Requirements Summary

Build a **React + Vite + TypeScript** web app that turns user-typed text into a
**Persona 5 "calling card" styled graphic rendered as SVG** (angled red/black
paper-cutout boxes, ransom-note letters with random red highlights). The white
cut-paper outline and the concentric red/black burst background — both
always-on in the reference — become **optional and off by default** per the
requirements below.

Reference: [LzxHahaha/persona5](https://github.com/LzxHahaha/persona5) — a
**canvas/pixel-based** implementation. We are reimplementing its visual algorithm
in **SVG** (vector output), which is the core technical work of this project.

### Confirmed decisions

| Decision | Choice |
| --- | --- |
| Framework / tooling | React + Vite + TypeScript |
| Output | Inline SVG preview; **Download SVG**, **Download PNG** (1x/2x/4x), **Copy PNG to clipboard** |
| Fonts | **Bundle one bold display font** (self-contained, consistent across machines), OFL/Apache licensed |
| **Background** | **Transparent by default.** User can set **a solid color** (any color via picker/hex) and/or enable the original **P5 burst** (concentric red/black circles). Fill and burst are independent and may combine. |
| **White outline** | **Off by default.** Toggleable on (the cut-paper white edge). |
| Deployment | Local only for now (`npm run dev` / `npm run build`) — hosting deferred |

### What changes vs. the reference (canvas → SVG)

The reference relies on two **raster-only** operations that do not exist in SVG and
must be re-expressed natively:

1. **Glyph bounding box** — reference scans `getImageData` pixels (`utils.getCharSize`).
   → Replace with Canvas `measureText` + `actualBoundingBox*` metrics (vector-friendly,
   no pixel scan), behind an injectable interface so it is unit-testable.
2. **White "paper edge" outline** — reference dilates pixels with a 6px convolution.
   → Replace with an SVG `feMorphology` dilate + white flood filter (radius ≈ 3),
   or a `paint-order:stroke` white stroke fallback. Cleaner and resolution-independent.
   **Now opt-in (off by default).**

Everything else maps directly:
- Angled black/red **boxes** → `<rect>` inside rotated `<g transform="rotate(a cx cy)">`.
- **Letters** → `<text>` with the bundled font.
- **Background** → two independent, composable sub-layers behind the glyphs:
  optional full-bleed `<rect fill="{fill}">` (when `fill` set) and optional
  alternating red/black `<circle>` burst (when `burst` true). Neither present = transparent (default).
- **Random red letters / angles / scales** → seeded PRNG (improvement: reproducible + testable).
- **Codepoint-safe input** → split with `Array.from(text)` (not `split('')`) so multi-byte
  characters aren't mangled; the bundled font drives which glyphs actually render.

---

## Key Design Decisions

- **Pure generator core.** `generateP5Svg(text, options, deps) → { svg, width, height }`
  (`deps = { metrics, fontFaceCss, rng? }`) is a pure function (no DOM side effects).
  Metrics and font CSS are injected so the core is testable in jsdom without a real
  canvas or `fetch`. This is the main testability win over the canvas reference.
- **Seeded RNG (mulberry32).** Replaces raw `Math.random()`. Enables a "re-roll"
  button, reproducible output, and deterministic snapshot tests.
- **Self-contained SVG.** The bundled font is embedded as a base64 `@font-face` inside
  the SVG `<defs><style>`. This is required so (a) the downloaded `.svg` renders the
  correct font anywhere, and (b) PNG rasterization (offscreen `<img>` → canvas) shows
  the font instead of a fallback.
- **Absolute angles about ONE shared pivot per glyph.** The canvas reference rotates the
  context cumulatively inside one `save()/restore()`, computing the pivot **once** and
  reusing it for every layer (`BoxText.ts:91,113`). Rotations about a common pivot compose
  additively, so each layer's absolute angle is: FIRST = `angle-5` (border rect),
  `angle-2` (red bg), `angle` (text); non-FIRST = `angle+1` (black bg), `angle` (text).
  **Critical precondition (do not omit):** all layers of a glyph rotate about the *same*
  pivot `P = (xOffset + outterWidth/2, padding + outterHeight/2)` — the outer border-box
  center — **not** each shape's own center. Note the rect Y-origin is `(H - outterHeight)/2`
  while the pivot Y is `padding + outterHeight/2`; these differ for any glyph that is not
  the tallest in the string, and both must be preserved to match the reference. Use
  `Math.ceil` for rotated box dimensions (`BoxChar.ts:71-72`) and emit coordinates/angles
  at fixed decimal precision (2 dp) so output is deterministic.
- **Colors preserved (glyph boxes/letters):** RED `#E5191C`, WHITE `#FDFDFD`, BLACK `#0F0F0F`.
  Note: with a user-chosen background color the "only-three-colors" invariant applies to
  the glyph collage, not the background fill.
- **Background and outline are independent, declarative options** — not baked into the
  render path. `background: { fill?: string; burst?: boolean }` (fill and burst compose;
  both absent = transparent) and `outline: { enabled: boolean; color?: string; radius?: number }`.
  Defaults: `background = {}` (transparent), `outline.enabled = false`. The renderer emits a
  full-bleed `<rect>` only when `fill` is set, the burst `<circle>`s only when `burst` is true,
  and the `paperEdge` filter only when `outline.enabled`. Transparent + no-outline is the
  literal default output. This `{fill?, burst?}` shape is forward-compatible — supporting
  "color *and* burst" needs no type change (unlike a mutually-exclusive `mode` enum).

---

## Proposed File Layout

```
persona-5-font-gen/
  index.html
  package.json
  tsconfig.json  tsconfig.node.json
  vite.config.ts                 # includes Vitest config (jsdom env)
  public/fonts/P5Display-Bold.woff2   # bundled bold display font (OFL/Apache)
  src/
    main.tsx                     # React entry
    App.tsx                      # state: text, fontSize, seed, pngScale
    index.css
    components/
      Controls.tsx               # text input, size, re-roll, export buttons, PNG scale
      SvgPreview.tsx             # renders generated SVG inline
    p5svg/                       # ── pure generator core (no DOM) ──
      index.ts                   # generateP5Svg(text, options, deps) public API
      types.ts                   # Options, CharMode, Colors, PlacedGlyph, Background, Outline
      rng.ts                     # mulberry32 PRNG + randomOp/range helpers
      metrics.ts                 # GlyphMetricsProvider interface + canvas impl
      layout.ts                  # port of BoxChar/BoxText: modes, angles, scales, shared-pivot placement
      render.ts                  # SVG string builder: bg fill/burst, boxes, text, optional paperEdge filter
      fontEmbed.ts               # FontEmbedder: load bundled font → base64 @font-face <style> (browser-only)
      __tests__/
        layout.test.ts
        render.test.ts           # fixed-seed normalized snapshot + conditional-emission asserts
    export/
      downloadSvg.ts
      downloadPng.ts             # SVG → FontFace warm → <img>.decode() → canvas@scale → toBlob → download
      copyPng.ts                 # ClipboardItem({'image/png'})
  e2e/
    visual.spec.ts               # Playwright: pixel diff vs reference, alpha + PNG-font assertions
  tests/reference/p5-take-your-heart.png   # committed visual-regression baseline
```

---

## Implementation Steps

### Phase 1 — Scaffold
1. Init Vite React-TS project; add Vitest + jsdom + `@testing-library/react` (optional).
2. Configure `vite.config.ts` with the Vitest block (`environment: 'jsdom'`).
3. Add a chosen OFL/Apache bold display font to `public/fonts/`; record its license in `README`/`LICENSES`.
   - Candidates: a heavy/black grotesque (e.g. an Archivo Black / Anton-style condensed bold). Final pick documented in repo.

### Phase 2 — Generator core (`src/p5svg/`) — port the algorithm
4. `types.ts`: `CharMode = FIRST | WHITE | RED | SPACE`; `Colors`; `PlacedGlyph`;
   `Background = { fill?: string; burst?: boolean }` (both absent = transparent; composable);
   `Outline = { enabled: boolean; color?: string; radius?: number }`;
   `Options { fontSize, gutter, padding, seed, maxChars, background, outline }` with defaults
   `background = {}`, `outline = { enabled: false, color: '#FDFDFD', radius: 3 }`, `maxChars = 30`.
5. `rng.ts`: mulberry32 from seed; `randomOp()` (±1), `range(min,max)`. Replaces `utils.randomOp` and all `Math.random()` calls.
6. `metrics.ts`: `interface GlyphMetricsProvider { measure(char, fontPx, fontFamily, weight): {width,height,top,left} }`; canvas implementation using `measureText().actualBoundingBox*`. **Awaits font load before measuring** (`document.fonts.load('bold 60px P5Display')`). Fallback height = `fontPx` when `actualBoundingBox*` unsupported.
7. `layout.ts`: port `BoxChar`/`BoxText`:
   - `Array.from(text.toUpperCase())` (codepoint-safe); enforce `maxChars` (truncate) before layout.
   - `modes[0]=FIRST`; red-letter selection in ranges of 5 (≤1 per range) via `rng`, preserving the
     reference's window arithmetic (`for i+=5 from 1`, inner `j < i+4`, break on first hit — `BoxText.ts:35-42`).
   - Per char: `angle = -(round(rng()*10)%10)` (base ∈ [-9,0]); FIRST scale 1.1 / angle as-is;
     others scale `1-(floor(rng()*10)%3)/10` (∈ {0.8,0.9,1.0}), `angle*randomOp()` (∈ [-9,9]).
   - `rotateSize` (use `Math.ceil`, `BoxChar.ts:71-72`) / `outterSize` (BorderScale 1.4 FIRST, BackgroundScale 1.2 others).
   - **Space width:** use `2*gutter` per space **consistently** in BOTH the size-measure and the
     placement pass (the reference disagrees with itself by `gutter` per space — `BoxText.ts:65` vs `:82`;
     we standardize on `2*gutter` so `viewBox` width matches glyph placement exactly).
   - Compute total width (`padding*2 + Σ(outterWidth+gutter)`, spaces `+2*gutter`), height
     (`max(outterHeight)+padding*2`), absolute x offset, the **shared per-glyph pivot**
     `P = (xOffset + outterWidth/2, padding + outterHeight/2)`, and per-layer absolute angles.
     Each `PlacedGlyph` carries its layers with a single shared `(cx,cy)` pivot.
8. `render.ts`: build the SVG string. **Explicit z-stack (bottom → top):**
   `(1) background fill rect` → `(2) burst circles` → `(3) glyph group (with optional paperEdge filter)`.
   - `<svg viewBox="0 0 W H">`.
   - **Background layer (conditional, behind glyphs):**
     - default (no `fill`, no `burst`): emit nothing — SVG stays transparent (PNG export must preserve alpha; Risk #9).
     - `fill` set: one full-bleed `<rect width=W height=H fill="{background.fill}">` (validate/normalize color first; Risk #10).
     - `burst` true: alternating red/black `<circle>` rings centered at `(W/2,H/2)`, **count and outermost
       color matched to the reference** (`step = W/10`, ~9–10 rings; outer ring color per `BoxText.ts:158-172`).
       Emit largest-radius first so smaller rings paint on top (SVG equivalent of the reference's `destination-over`).
   - **`paperEdge` `<filter>` (conditional):** emitted and applied to the glyph group **only when `outline.enabled`** —
     `feMorphology operator="dilate" radius="{outline.radius}"` on `SourceAlpha` → `feFlood flood-color="{outline.color}"`
     → `feComposite operator="in"` → `feMerge` (edge under `SourceGraphic`). When disabled, the glyph group has no filter.
     The white edge therefore sits *between* the background and the glyphs.
   - FIRST glyph: black border `<rect>` (rotate `angle-5`), red bg rect 0.85 scale (rotate `angle-2`), `<text>` (rotate `angle`) — **all about the shared pivot `(cx,cy)`**.
   - WHITE/RED glyph: black bg `<rect>` (rotate `angle+1`), `<text>` (rotate `angle`) — **about the shared pivot**.
   - Rect Y-origin = `(H - outterHeight)/2`; pivot Y = `padding + outterHeight/2` (differ for non-tallest glyphs — keep both).
   - Text positioned with measured `top`/`left` offsets to center each glyph in its box (`textLeft = boxLeft + (boxW-glyphW)/2 - left`).
   - Emit all numeric coords/angles at fixed precision (2 dp) for deterministic output.
9. `fontEmbed.ts`: fetch bundled woff2 → base64 → `@font-face{font-family:'P5Display';src:url(data:font/woff2;base64,...)}` for the SVG `<defs><style>`. **The `fetch` is browser-only** — expose it behind a `FontEmbedder` interface (mirroring `GlyphMetricsProvider`) and have `render.ts` accept the `@font-face` `<style>` string as an injected input, so `render.test.ts` can pass a stub and run in jsdom (no `fetch`).
10. `index.ts`: `generateP5Svg(text, options, deps)` (deps = `{ metrics, fontFaceCss, rng? }`) wiring layout → render; default seed when none given. **Empty/whitespace-only `text` → throw `EmptyTextError`** (callers/UI guard before calling and disable export on empty input). Over-`maxChars` input is truncated by layout (UI surfaces the cap).

### Phase 3 — React UI
11. `App.tsx`: state for text, fontSize, seed, pngScale; regenerate SVG (debounced) on change; re-roll = new seed.
12. `Controls.tsx`: text input, font-size control, **Re-roll**, **Download SVG / Download PNG / Copy PNG**, PNG scale (1x/2x/4x). Plus:
    - **Background**: a **Solid color** checkbox + color input (`<input type="color">` + hex field),
      and an independent **P5 Burst** checkbox — both off by default (transparent). They may be combined.
    - **Outline**: checkbox `White outline` (unchecked by default); optional color/radius controls revealed when checked.
    - Text input enforces `maxChars` (30) with a visible counter; **export buttons disabled** on empty/whitespace input.
    A small checkerboard backdrop behind the preview makes transparency visible to the user.
13. `SvgPreview.tsx`: render the generated SVG inline.
14. Gate first render on `document.fonts.ready` so initial metrics are correct.

### Phase 4 — Export (`src/export/`)
15. `downloadSvg.ts`: Blob `image/svg+xml` → object URL → `<a download>`.
16. `downloadPng.ts` — **rasterize with the WebKit-219770 font race mitigated** (bug: `img.onload` can
    fire before the embedded SVG font is applied, producing a fallback-font PNG):
    (a) build a `FontFace` from the same base64 woff2, `await fontFace.load()`, `document.fonts.add()`
    to warm the shared cache; (b) load the self-contained SVG into an `<img>` and `await img.decode()`
    (not just `onload`); (c) WebKit belt-and-braces: a short `setTimeout` retry / double-draw fallback.
    Then draw to canvas at `W*scale × H*scale` (1x/2x/4x) — **do not fill the canvas** (preserve alpha) —
    `toBlob('image/png')` → download. `document.fonts.ready` does NOT cover this isolated `<img>` path.
17. `copyPng.ts`: reuse the step-16 PNG blob → `navigator.clipboard.write([new ClipboardItem({'image/png': blob})])`; guard secure-context/support, surface a message on failure.

### Phase 5 — Tests & polish
18. `layout.test.ts` (Vitest/jsdom, fixed seed, **stub metrics**): first char is FIRST; red letters obey the
    range rule (≤1 per 5-window); angle ∈ [-9,9] / scale ∈ {0.8,0.9,1.0,1.1}; total size math; space = `2*gutter`;
    **the 3 layers of the FIRST glyph share one `(cx,cy)` pivot** and `pivotY = padding + outterHeight/2`
    (independent of rect top); `maxChars` truncation; `EmptyTextError` on empty/whitespace.
19. `render.test.ts` (Vitest/jsdom, fixed seed, **stubbed `fontFaceCss`**): default options →
    **no background `<rect>`, no burst `<circle>`, no `paperEdge` filter** (transparent default);
    `fill` set → exactly one full-bleed `<rect>`; `burst` → circles; `outline.enabled` → `paperEdge` present;
    glyph collage uses only the three brand colors; `@font-face` present when CSS injected.
    Snapshot a **normalized** SVG (coords at 2 dp, font CSS stripped/placeholdered) — not raw bytes — to avoid flakiness.
20. `visual.spec.ts` (**Playwright, browser-only** — available in this environment): render fixed-seed
    "TAKE YOUR HEART", diff against a committed reference PNG (pixel-fidelity check the unit tests can't do);
    assert **default PNG export has a transparent corner pixel** (alpha preserved); assert the **PNG contains
    the bundled font** (not a fallback) by pixel-comparing against a font-loaded baseline; exercise SVG/PNG/clipboard exports.
21. Manual spot-check: compare burst/outline/colored variants against the reference `demo.png` aesthetic; confirm `npm run build`.

---

## Acceptance Criteria (testable)

- [ ] `npm run dev` serves the app; `npm run build` produces `dist/` with no type errors.
- [ ] Entering `TAKE YOUR HEART` with **defaults** renders a styled SVG with: ≥1 red letter, the first letter on a red box, a **transparent background (no background `<rect>`/circles)**, and **no white outline filter**.
- [ ] **Background option:** enabling **Solid color** adds exactly one full-bleed `<rect>` with the chosen color; enabling **P5 Burst** adds the concentric `<circle>` background; both can be on together; both off (default) = transparent (no `<rect>`/circles).
- [ ] **Outline option:** the `paperEdge` filter is present in the SVG **only when** the outline toggle is on; absent by default.
- [ ] Glyph collage uses only `#E5191C`, `#FDFDFD`, `#0F0F0F` (asserted in `render.test.ts`); the user-chosen background color is the only permitted additional color.
- [ ] Same `(text, seed, options)` produces an identical **normalized** SVG (coords at 2 dp, font CSS placeholdered); **Re-roll** changes the layout.
- [ ] All 3 layers of the FIRST glyph share one rotation pivot `(cx,cy)` with `cy = padding + outterHeight/2` (asserted in `layout.test.ts`).
- [ ] **Hard cap:** input over **30 chars** is truncated (or blocked) with visible UI feedback; **empty/whitespace** input disables export and `generateP5Svg` throws `EmptyTextError`.
- [ ] **Download SVG** yields a self-contained `.svg` that renders the bundled font when opened standalone (no network).
- [ ] **Download PNG** yields a raster at the selected scale (1x/2x/4x) with the bundled font visible (not a fallback) — verified in `visual.spec.ts` against the WebKit font-race mitigation.
- [ ] **Default PNG export preserves transparency** — a corner pixel has alpha 0 (asserted in `visual.spec.ts`, browser-only).
- [ ] **Copy PNG** places an `image/png` on the clipboard in a secure context (localhost).
- [ ] `layout.test.ts`: first char = FIRST mode; ≤1 red letter per 5-char range; angle ∈ [-9,9], scale ∈ {0.8,0.9,1.0,1.1}.
- [ ] `npm run test` (Vitest/jsdom) passes locally with stubbed metrics + font CSS; `npx playwright test` passes the visual + export specs in a real browser.

---

## Risks and Mitigations

| # | Risk | Mitigation |
| --- | --- | --- |
| 1 | Glyph metrics measured before the bundled font loads → wrong boxes | `await document.fonts.load(...)` / gate on `document.fonts.ready`; injectable metrics interface |
| 2 | PNG/clipboard render fallback font (WebKit bug 219770: `img.onload` fires before embedded SVG font applies) | Embed base64 `@font-face` (necessary, not sufficient); **also** warm a `FontFace` in the parent doc + `await img.decode()` + `setTimeout`/double-draw fallback (step 16); verify in `visual.spec.ts` |
| 3 | `actualBoundingBox*` unsupported on old browsers | Fallback to `measureText().width` + font-size-based height; documented in `metrics.ts` |
| 4 | `feMorphology` outline look (blocky corners) / perf (cost scales with bbox) on long text | **Hard cap 30 chars** (enforced in layout + UI, not just a note); tune `outline.radius`; `paint-order:stroke` fallback documented |
| 5 | Rotation mismatch with reference (per-shape vs shared pivot) | Shared per-glyph pivot `(cx,cy)` for all layers + absolute angles; `layout.test.ts` asserts shared pivot; `visual.spec.ts` diff vs reference |
| 6 | jsdom has no canvas/`fetch` for unit tests | Pure core + stubbed `GlyphMetricsProvider` **and** injected `fontFaceCss`; browser-only paths (export, alpha, pixel diff) live in `visual.spec.ts` |
| 7 | Bundled font licensing | Use OFL/Apache font; record license file in repo |
| 8 | Clipboard needs secure context | localhost is secure; show a clear error if `ClipboardItem`/permission unavailable |
| 9 | Transparent background lost on PNG export (canvas defaults / older iOS Safari) | Do not fill the export canvas; rely on default transparency + `toBlob('image/png')` (preserves alpha); assert a transparent corner pixel in `visual.spec.ts` (browser-only, not jsdom); document iOS Safari as a known limitation |
| 10 | Invalid/empty user background color string breaks the SVG | Validate/normalize hex/CSS color before injecting; fall back to transparent on invalid input |
| 11 | Multi-codepoint input (emoji, surrogate pairs) mangled by `split('')` | Use `Array.from()` for splitting; document that non-Latin/emoji glyphs depend on the bundled font and may not render in the P5 style |

---

## Verification Steps

1. `npm run test` — Vitest/jsdom unit tests green (layout incl. shared-pivot assertion + render conditional-emission + normalized snapshot).
2. `npx playwright test` — visual-regression diff vs committed reference PNG; transparent-corner-pixel (alpha) assertion; PNG-font-present assertion; export-path smoke.
3. `npm run build` — zero TypeScript errors, `dist/` emitted.
4. `npm run dev` — manual: render "TAKE YOUR HEART", re-roll, toggle fill/burst/outline, compare to reference `demo.png`.
5. Export each format; open downloaded `.svg` directly (font present), open `.png` (font present, transparent where expected), paste clipboard PNG into another app.
6. Confirm deterministic normalized output for a fixed `(text, seed, options)` across two generations.

---

## RALPLAN-DR Summary (short mode)

### Principles
1. **Pure, testable core.** The generator is a deterministic pure function; all DOM/canvas/font I/O is injected, so logic is unit-testable in jsdom.
2. **Faithful to the reference look, configurable at the edges.** Match the P5 collage algorithm exactly; expose background and outline as declarative options rather than hard-coded layers.
3. **Sensible, minimal defaults.** Default output = transparent background + no outline (per user requirement); options add, never surprise.
4. **Self-contained artifacts.** Exported SVG/PNG render identically anywhere (embedded font, preserved alpha) with no network dependency.
5. **Vector-native, not raster-ported.** Re-express the two raster steps (bbox, outline) with SVG-native mechanisms instead of pixel loops.

### Decision Drivers (top 3)
1. **SVG output fidelity** vs. the canvas reference (the hard part: metrics + outline).
2. **Configurability of background/outline** without polluting the pure core or breaking the color invariant.
3. **Export correctness** — font embedding and transparent-alpha preservation across SVG and PNG.

### Viable Options

**A. Declarative composable `background: { fill?: string; burst?: boolean }` — CHOSEN (post-consensus synthesis of original A + C).**
- Pros: one declarative option; transparent default is "both fields absent → emit nothing"; fill and burst compose (color *and* burst) with **zero type rework**; trivially testable (assert presence/absence of `<rect>`/`<circle>`); explicit z-order (fill → burst → glyphs).
- Cons: two booleans/fields instead of one enum (negligible).

**B. Keep the burst always-on (reference behavior), add only a transparency toggle.**
- Pros: closest to reference.
- Cons: **violates the explicit requirement** (transparent must be the default, arbitrary color must be selectable). Rejected.

**C. Mutually-exclusive `mode: 'transparent' | 'color' | 'burst'` enum (the initial draft).**
- Pros: single value; matches a simple "pick one" mental model.
- Cons: **cannot express color *and* burst** without a breaking type/branch change — the Architect showed the "extend later without rework" claim was false for an enum. Superseded by A.

**Outline options:**
- **A. `feMorphology` dilate filter, toggled by `outline.enabled` (default false) — CHOSEN.** Most faithful to the 6px pixel dilation; one filter def emitted only when enabled.
- **B. `paint-order:stroke` white stroke per `<text>`.** Simpler but only outlines letters, not the box collage edges; kept as a documented fallback (Risk #4), not the primary.

### Invalidation rationale
Option B is invalid against the stated requirement (transparent must default; arbitrary color must be selectable). Option C (the initial enum draft) was superseded once the Architect demonstrated it could not represent "color + burst" without a breaking change; the chosen `{fill?, burst?}` shape (A) absorbs C's flexibility at no extra present cost.

---

## Out of Scope (this iteration)

- Hosting/deployment (deferred — local only).
- Multiple font choices / user font upload (single bundled font this round).
- Animation, additional P5 UI motifs beyond the calling-card text style.
- Mobile-optimized layout (functional but not a focus).

---

## ADR — Architecture Decision Record

**Decision.** Build the generator as a **pure, dependency-injected SVG core** (`generateP5Svg(text, options, deps)`)
with a seeded PRNG, glyph metrics and font-embedding behind injectable interfaces, and **declarative composable
options** for background (`{ fill?, burst? }`, transparent default) and outline (`{ enabled, … }`, off default).
React+Vite drives the UI; SVG/PNG/clipboard export sits in a thin browser-only layer.

**Drivers.** (1) SVG-output fidelity to the canvas reference; (2) configurable background/outline without
polluting the pure core or breaking the 3-color glyph invariant; (3) export correctness (font embedding +
alpha preservation across SVG and PNG).

**Alternatives considered.**
- *Background:* enum `mode` (C, superseded — can't compose color+burst) and always-on burst (B, violates requirement).
- *Outline:* `paint-order:stroke` per-letter (kept only as a degraded fallback — doesn't outline box-collage edges).
- *Metrics:* reference's `getImageData` pixel-bbox (raster-only; replaced by `measureText` + `actualBoundingBox*`).
- *Testing:* jsdom-only (rejected as insufficient — can't diff pixels or test export; added Playwright harness).

**Why chosen.** The pure core makes logic deterministic and unit-testable; injectable metrics/font-embed keep
jsdom tests runnable; the `{fill?, burst?}` shape satisfies the new requirements *and* is forward-compatible
(neutralizes the Architect's strongest objection at no cost); SVG-native re-expression of the two raster steps
is cleaner and resolution-independent.

**Consequences.**
- (+) Deterministic, testable, self-contained artifacts; defaults match the user's request exactly.
- (−) The two platform translations (shared-pivot rotation; SVG-in-`<img>` font timing) carry residual risk
  that *only* the browser-only Playwright visual diff can fully catch — so a real-browser test pass is mandatory, not optional.
- (−) `feMorphology` outline has blocky corners and a perf cliff → hard 30-char cap.

**Follow-ups (future iterations).** Multiple/uploadable fonts; hosting (deferred); richer burst controls
(ring count/colors); emoji/non-Latin handling beyond best-effort; per-letter manual color overrides.

---

## Consensus Changelog (improvements applied this round)

Merged from Architect (sound-with-changes) + Critic (approve-with-improvements). All non-blocking; no blocking issues were raised.

1. **Shared rotation pivot** made explicit (all glyph layers about one `(cx,cy)`; rect-Y vs pivot-Y offset documented) + `layout.test.ts` assertion. *(Architect #1, Critic #1)*
2. **PNG/clipboard WebKit-219770 font race** hardened: warm `FontFace` + `await img.decode()` + fallback (step 16, Risk #2). *(Architect #2)*
3. **Font embedding made injectable** (`fontFaceCss`/`FontEmbedder`) so `render.test.ts` runs in jsdom. *(Architect #3, Critic gap)*
4. **Hard 30-char cap** (layout + UI enforced), replacing the vague "cap text length". *(Architect #4, Critic gap)*
5. **Explicit 3-layer z-stack** documented (fill → burst → outline-filtered glyphs). *(Architect #5, Critic #6)*
6. **Playwright visual-regression harness** added; pixel/alpha tests moved out of jsdom. *(Architect synthesis a, Critic #4)*
7. **Background type → `{ fill?, burst? }`** (composable, forward-compatible); enum demoted to superseded alternative C. *(Architect synthesis b, Critic #5)*
8. **Space width standardized to `2*gutter`** in both passes (resolves reference's latent measure/draw mismatch). *(Critic #2)*
9. **Deterministic output** via fixed 2-dp coordinate precision + `Math.ceil` dims; "byte-identical" → **normalized** snapshot. *(Critic #3)*
10. **Empty/whitespace input** → `EmptyTextError` + export disabled; **codepoint-safe `Array.from` split** + emoji scope note (Risk #11). *(Critic gaps)*
11. **Burst ring count/outer color** pinned to the reference (`step = W/10`); angle bounds corrected to [-9,9], scale to {0.8,0.9,1.0,1.1}. *(Critic #6, Architect distribution note)*

---

## Next Steps

This plan is **pending approval**. On approval, choose an execution path:
- **Team** (`/team`) — parallel agents across the phases (recommended for the multi-file build).
- **Ralph** (`/ralph`) — sequential execution with verification.
- Or request changes / a consensus (`--consensus`) review pass first.
