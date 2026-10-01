// Functional + accessibility QA against the production preview.
// Usage: node scripts/qa.mjs [baseUrl]
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = process.argv[2] ?? 'http://localhost:4321';
const pages = ['/', '/projects/my-crm/', '/projects/hush/', '/projects/golf/', '/projects/assessly/', '/projects/face-detector/', '/missing-page/'];
const videoSlugs = ['my-crm', 'hush', 'golf', 'face-detector'];
const results = [];
const check = (name, ok, detail = '') => results.push({ check: name, result: ok ? 'PASS' : 'FAIL', detail });

const launched = await chromium.launch();
// axe needs pages created from an explicit context, so every page gets its own.
const browser = {
  async newPage(options = {}) {
    const context = await launched.newContext(options);
    const page = await context.newPage();
    page.close = () => context.close(); // closing a page tears down its whole context
    return page;
  },
  close: () => launched.close(),
};

// 1. axe on every page, light and dark.
for (const scheme of ['light', 'dark']) {
  for (const path of pages) {
    const page = await browser.newPage({ colorScheme: scheme, reducedMotion: 'reduce' });
    await page.goto(base + path, { waitUntil: 'networkidle' });
    const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    check(`axe ${scheme} ${path}`, violations.length === 0,
      violations.map((v) => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`).join(' | '));
    await page.close();
  }
}

// 2. Walkthroughs play and captions load.
for (const slug of videoSlugs) {
  const page = await browser.newPage();
  await page.goto(`${base}/projects/${slug}/`, { waitUntil: 'networkidle' });
  const info = await page.evaluate(async () => {
    const v = document.querySelector('video[controls]');
    const autoplay = v.autoplay || !v.paused;
    const preloadAttr = v.getAttribute('preload'); // read before the test changes it
    v.muted = true; // allow programmatic playback in headless Chromium
    v.preload = 'auto';
    v.load();
    await v.play();
    await new Promise((r) => setTimeout(r, 1500));
    const track = v.querySelector('track');
    const tt = v.textTracks[0];
    const cues = tt.cues ? tt.cues.length : 0;
    v.pause();
    return {
      readyState: v.readyState, currentTime: v.currentTime, preloadAttr,
      trackReady: track.readyState, mode: tt.mode, cues, autoplay, poster: v.poster,
      src: v.currentSrc, trackSrc: track.src,
    };
  });
  check(`video plays: ${slug}`, info.readyState >= 2 && info.currentTime > 0.5, `readyState ${info.readyState}, t=${info.currentTime.toFixed(2)}s, src ${new URL(info.src).pathname}`);
  check(`captions load: ${slug}`, info.trackReady === 2 && info.cues > 0, `${info.cues} cues, mode ${info.mode}, ${new URL(info.trackSrc).pathname}`);
  check(`no autoplay, preload=none: ${slug}`, !info.autoplay && info.preloadAttr === 'none', `autoplay ${info.autoplay}, preload "${info.preloadAttr}", poster ${new URL(info.poster).pathname}`);
  await page.close();
}

// 3. Assessly facade: no YouTube request until click, then the right video.
{
  const page = await browser.newPage();
  const ytRequests = [];
  page.on('request', (r) => { if (/youtube|ytimg|googlevideo/.test(r.url())) ytRequests.push(r.url()); });
  await page.goto(`${base}/projects/assessly/`, { waitUntil: 'networkidle' });
  const before = ytRequests.length;
  await page.click('[data-yt-play]');
  const src = await page.locator('.yt iframe').getAttribute('src');
  const title = await page.locator('.yt iframe').getAttribute('title');
  check('Assessly: no YouTube requests before click', before === 0, `${before} requests before click`);
  check('Assessly: iframe loads the right video', src.startsWith('https://www.youtube-nocookie.com/embed/fwXobqQA5SY'), `${src} · title "${title}"`);
  await page.close();
}

// 4. Résumé.
{
  const res = await fetch(`${base}/Caelan-Hartley-Resume.pdf`);
  const buf = new Uint8Array(await res.arrayBuffer());
  const magic = String.fromCharCode(...buf.slice(0, 5));
  check('Résumé downloads as a PDF', res.status === 200 && res.headers.get('content-type') === 'application/pdf' && magic === '%PDF-', `${res.status} ${res.headers.get('content-type')} ${buf.length} bytes`);
}

// 5. External links.
for (const url of ['https://github.com/chartle5', 'https://www.linkedin.com/in/chartle22', 'https://www.youtube.com/watch?v=fwXobqQA5SY']) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) link-check' } });
    // LinkedIn answers automated requests with 999 even for valid profiles.
    const ok = res.status === 200 || (url.includes('linkedin') && res.status === 999);
    check(`external link: ${url}`, ok, `HTTP ${res.status}`);
  } catch (e) {
    check(`external link: ${url}`, false, String(e));
  }
}

// 6. Lightbox, deep link and keyboard.
{
  const page = await browser.newPage();
  await page.goto(`${base}/projects/golf/`, { waitUntil: 'networkidle' });
  await page.locator('[data-shot="2"]').scrollIntoViewIfNeeded();
  await page.click('[data-shot="2"]');
  const open = await page.locator('dialog[open]').count();
  const hash = await page.evaluate(() => location.hash);
  await page.keyboard.press('ArrowRight');
  const count = await page.locator('[data-lb-count]').textContent();
  await page.keyboard.press('Escape');
  const closed = await page.locator('dialog[open]').count();
  check('Lightbox opens, arrows move, Esc closes', open === 1 && count === '4 / 7' && closed === 0, `hash ${hash}, counter "${count}"`);
  const deep = await browser.newPage();
  await deep.goto(`${base}/projects/golf/#screenshot-5`, { waitUntil: 'networkidle' });
  await deep.waitForTimeout(1200);
  const deepCount = await deep.locator('[data-lb-count]').textContent();
  check('Lightbox deep link #screenshot-5', (await deep.locator('dialog[open]').count()) === 1 && deepCount === '5 / 7', `counter "${deepCount}"`);
  await page.close();
  await deep.close();
}

// 7. Theme toggle persists across a view-transition navigation.
{
  const page = await browser.newPage({ colorScheme: 'light' });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.click('[data-theme-toggle]');
  await page.click('a.link[href="/projects/hush/"]');
  await page.waitForURL('**/projects/hush/');
  await page.waitForTimeout(800);
  const theme = await page.evaluate(() => document.documentElement.dataset.theme);
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('Theme toggle persists across navigation', theme === 'dark' && bg === 'rgb(10, 12, 16)', `data-theme=${theme}, body ${bg}`);
  await page.close();
}

// 8. Reduced motion: no autoplaying previews, diagrams drawn statically, content visible.
{
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1440, height: 900 } });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await page.hover('a.link[href="/projects/golf/"]');
  await page.waitForTimeout(800);
  const playing = await page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused).length);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('[data-reveal], .ch')].filter((el) => getComputedStyle(el).opacity === '0').length);
  check('Reduced motion: no videos play (hero reel, hover previews)', playing === 0, `${playing} playing`);
  check('Reduced motion: nothing left hidden by reveal states', hidden === 0, `${hidden} hidden`);
  await page.goto(base + '/projects/my-crm/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const drawn = await page.evaluate(() => document.querySelector('[data-diagram]').classList.contains('is-drawn'));
  check('Reduced motion: diagram drawn statically', drawn);
  await page.close();
}

// 9. No console errors on any page (the 404 page's own status excepted).
for (const path of pages) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('404') && errors.push(m.text()));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check(`no console errors ${path}`, errors.length === 0, errors.join(' | '));
  await page.close();
}

await browser.close();
console.table(results);
const failed = results.filter((r) => r.result === 'FAIL');
console.log(failed.length ? `${failed.length} check(s) failed.` : `All ${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
