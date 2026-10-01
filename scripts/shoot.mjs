// QA screenshots: every page × 390 / 768 / 1440 × light / dark, full page, after a
// scroll-through so lazy media load and reveals fire. Also flags horizontal overflow.
// Usage: node scripts/shoot.mjs [baseUrl] [--only=/path/] [--widths=390,1440]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const base = args.find((a) => a.startsWith('http')) ?? 'http://localhost:4321';
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const widths = (args.find((a) => a.startsWith('--widths='))?.slice(9) ?? '390,768,1440').split(',').map(Number);
const schemes = (args.find((a) => a.startsWith('--schemes='))?.slice(10) ?? 'light,dark').split(',');

const pages = only ? [only] : ['/', '/projects/my-crm/', '/projects/hush/', '/projects/golf/', '/projects/assessly/', '/projects/face-detector/', '/missing-page/'];
const out = resolve('qa/screens');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const problems = [];
for (const path of pages) {
  for (const width of widths) {
    for (const scheme of schemes) {
      const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 }, colorScheme: scheme });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1600);
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) {
          scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 160));
        }
        await Promise.all([...document.images].map((img) => img.decode().catch(() => {})));
        scrollTo(0, 0);
      });
      await page.waitForTimeout(1400);
      const name = `${path === '/' ? 'home' : path.replaceAll('/', '_').replace(/^_|_$/g, '')}-${width}-${scheme}.png`;
      await page.screenshot({ path: resolve(out, name), fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (overflow > 0) problems.push(`${name}: horizontal overflow ${overflow}px`);
      errors.forEach((e) => problems.push(`${name}: ${e}`));
      await page.close();
    }
  }
}
await browser.close();
console.log(problems.length ? problems.join('\n') : `All ${pages.length * widths.length * schemes.length} screenshots clean (no overflow, no console errors).`);
