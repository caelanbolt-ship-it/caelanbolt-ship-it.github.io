// Crawl the production build: collect every URL referenced from dist/**/*.html
// (href, src, srcset, poster, track, og:image, preload), request each one from the
// preview server, and fail on anything that isn't 200. Also proves no export
// internals (REPORT.md, *.patch, content.md, embed.html, manifest.json) shipped.
// Usage: node scripts/crawl.mjs [baseUrl]
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const base = process.argv[2] ?? 'http://localhost:4321';
const DIST = 'dist';

const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

// 1. Internals must not ship.
const forbidden = /(^|\/)(REPORT\.md|content\.md|embed\.html|manifest\.json)$|\.patch$/i;
const leaked = [...walk('public'), ...walk(DIST)].filter((f) => forbidden.test(f));

// 2. Collect references.
const attr = /\s(?:href|src|data-src|poster|content)="([^"]+)"/g;
const srcset = /\s(?:srcset|imagesrcset)="([^"]+)"/g;
const refs = new Map(); // url -> set of pages
const pages = walk(DIST).filter((f) => f.endsWith('.html'));
for (const file of pages) {
  const html = readFileSync(file, 'utf8');
  const page = '/' + relative(DIST, file).replace(/index\.html$/, '');
  const add = (u) => {
    if (!u || u.startsWith('#') || u.startsWith('mailto:') || u.startsWith('data:')) return;
    if (u.startsWith('https://chartle5.github.io')) u = u.replace('https://chartle5.github.io', '');
    if (!u.startsWith('/') && !u.startsWith('http')) return; // meta content like "summary_large_image"
    if (!refs.has(u)) refs.set(u, new Set());
    refs.get(u).add(page);
  };
  for (const m of html.matchAll(attr)) add(m[1].split('#')[0] || m[1]);
  for (const m of html.matchAll(srcset)) m[1].split(',').forEach((part) => add(part.trim().split(/\s+/)[0]));
}

// 3. Request everything internal; external links are listed but not fetched here.
const internal = [...refs.keys()].filter((u) => u.startsWith('/')).sort();
const external = [...refs.keys()].filter((u) => u.startsWith('http')).sort();
const results = [];
for (const url of internal) {
  const res = await fetch(base + url, { method: url.endsWith('.mp4') ? 'HEAD' : 'GET' });
  results.push({ url, status: res.status, type: (res.headers.get('content-type') ?? '').split(';')[0] });
}

const media = results.filter((r) => r.url.startsWith('/media/'));
console.log(`\n/media paths referenced by the site (${media.length}):`);
console.table(media);
const others = results.filter((r) => !r.url.startsWith('/media/'));
console.log(`\nOther internal URLs (${others.length}):`);
console.table(others);
console.log(`\nExternal links (${external.length}), checked separately:`);
external.forEach((u) => console.log('  ' + u));

const bad = results.filter((r) => r.status !== 200);
console.log(`\nPages crawled: ${pages.length}. Internal URLs: ${results.length}. Non-200: ${bad.length}.`);
bad.forEach((r) => console.log(`  ✗ ${r.status} ${r.url} (from ${[...refs.get(r.url)].join(', ')})`));
console.log(leaked.length ? `✗ Export internals found:\n  ${leaked.join('\n  ')}` : '✓ No REPORT.md, *.patch, content.md, embed.html or manifest.json in public/ or dist/.');
if (bad.length || leaked.length) process.exitCode = 1;
