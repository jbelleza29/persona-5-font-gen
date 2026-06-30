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
  await expect(svg.locator('#p5-sticker')).toHaveCount(0);
});

test('background and outline toggles add their layers', async ({ page }) => {
  await page.getByText('P5 burst rings').click();
  await page.getByText('White cut-paper outline').click();
  const svg = page.locator('.preview__svg svg');
  await expect(svg.locator('#bg-burst')).toHaveCount(1);
  await expect(svg.locator('#p5-sticker')).toHaveCount(1);
});

test('PNG rasterization: transparent top corner + opaque ink in content', async ({ page }) => {
  const stats = await page.locator('.preview__svg svg').evaluate(async (el) => {
    const svgEl = el as unknown as SVGSVGElement;
    const w = Math.ceil(svgEl.viewBox.baseVal.width);
    const h = Math.ceil(svgEl.viewBox.baseVal.height);
    const markup = new XMLSerializer().serializeToString(svgEl);
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
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
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 0) opaque++;
    // sample the top padding band (above the glyph row) for transparency
    const cornerAlpha = data[(2 * w + Math.floor(w / 2)) * 4 + 3];
    return { opaque, cornerAlpha };
  });
  expect(stats.cornerAlpha).toBe(0); // default export preserves transparency
  expect(stats.opaque).toBeGreaterThan(100); // glyphs actually rasterized
});
