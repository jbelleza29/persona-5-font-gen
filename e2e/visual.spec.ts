import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  // wait for the generated SVG to appear (font loaded + first render done)
  await expect(page.locator('.preview__svg svg')).toBeVisible({ timeout: 15_000 });
});

test('renders a styled P5 SVG for the default text', async ({ page }) => {
  const svg = page.locator('.preview__svg svg');
  await expect(svg.locator('#glyphs')).toBeAttached();
  // collage has letters and at least one box
  expect(await svg.locator('#glyphs text').count()).toBeGreaterThan(0);
  expect(await svg.locator('#glyphs rect').count()).toBeGreaterThan(0);
  // self-contained: embedded font face present
  const markup = await svg.evaluate((el) => el.outerHTML);
  expect(markup).toContain('@font-face');
});

test('default output is transparent with no background or outline', async ({ page }) => {
  const svg = page.locator('.preview__svg svg');
  await expect(svg.locator('#bg-fill')).toHaveCount(0);
  await expect(svg.locator('#bg-burst')).toHaveCount(0);
  await expect(svg.locator('#paperEdge')).toHaveCount(0);
});

test('background and outline toggles add their layers', async ({ page }) => {
  await page.getByText('P5 burst rings').click();
  await page.getByText('White cut-paper outline').click();
  const svg = page.locator('.preview__svg svg');
  await expect(svg.locator('#bg-burst')).toHaveCount(1);
  await expect(svg.locator('#paperEdge')).toHaveCount(1);
});

test('default PNG export preserves transparency (alpha 0 in top padding)', async ({ page }) => {
  const alpha = await page.locator('.preview__svg svg').evaluate(async (el) => {
    const svgEl = el as unknown as SVGSVGElement;
    const w = Math.ceil(svgEl.viewBox.baseVal.width);
    const h = Math.ceil(svgEl.viewBox.baseVal.height);
    const markup = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('img load failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    // sample a pixel in the top padding band (above the glyph row)
    const px = ctx.getImageData(Math.floor(w / 2), 2, 1, 1).data;
    return px[3];
  });
  expect(alpha).toBe(0);
});

test('content region has opaque ink (glyphs actually rasterize)', async ({ page }) => {
  const opaque = await page.locator('.preview__svg svg').evaluate(async (el) => {
    const svgEl = el as unknown as SVGSVGElement;
    const w = Math.ceil(svgEl.viewBox.baseVal.width);
    const h = Math.ceil(svgEl.viewBox.baseVal.height);
    const markup = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('img load failed'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const data = ctx.getImageData(0, 0, w, h).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) count++;
    return count;
  });
  expect(opaque).toBeGreaterThan(100);
});
