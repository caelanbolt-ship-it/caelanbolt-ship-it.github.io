// Copies (never moves) allowlisted media from the read-only exports into public/media/<slug>/,
// then proves each copy matches its source by SHA-256.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import { EXPORTS, SLUGS, listedFiles } from './verify-exports.mjs';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const RESUME_SRC = '/Users/caelanhartley/portfolio/Caelan_Hartley_Resume.pdf';
const RESUME_DEST = join(ROOT, 'public/Caelan-Hartley-Resume.pdf');

const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

function dimensions(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file]).toString().trim();
  const [width, height] = out.split(',').map(Number);
  return { width, height };
}

const rows = [];
let mismatches = 0;

function copyChecked(src, dest, label) {
  if (resolve(src).startsWith(EXPORTS) && resolve(dest).startsWith(EXPORTS)) {
    throw new Error('Refusing to write inside the exports folder');
  }
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
  const a = sha256(src);
  const b = sha256(dest);
  if (a !== b) mismatches++;
  rows.push({ file: label, sha256: a.slice(0, 16) + '…', match: a === b ? 'OK' : 'MISMATCH' });
}

for (const slug of SLUGS) {
  const dir = join(EXPORTS, slug);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const dims = {};
  for (const rel of listedFiles(manifest)) {
    const src = join(dir, rel);
    copyChecked(src, join(ROOT, 'public/media', slug, rel), `${slug}/${rel}`);
    if (/\.(jpe?g|webp|png|mp4)$/i.test(rel)) dims[rel] = dimensions(src);
  }
  // Site metadata only: title, tagline, duration, alt text and measured dimensions.
  const data = { slug, title: manifest.title, tagline: manifest.tagline, duration: manifest.duration,
    alt: manifest.alt, screenshots: manifest.files.screenshots, dims };
  mkdirSync(join(ROOT, 'src/data/manifests'), { recursive: true });
  writeFileSync(join(ROOT, 'src/data/manifests', `${slug}.json`), JSON.stringify(data, null, 2) + '\n');
}

if (existsSync(RESUME_SRC)) {
  copyChecked(RESUME_SRC, RESUME_DEST, 'Caelan-Hartley-Resume.pdf');
} else {
  rows.push({ file: 'Caelan-Hartley-Resume.pdf', sha256: '—', match: 'SOURCE MISSING' });
}

// Derived, smaller poster variants for cards and the hero (the originals stay untouched).
// Assessly has no export; its poster is the YouTube thumbnail saved once in public/media/assessly/.
const derived = [];
for (const slug of [...SLUGS, 'assessly']) {
  const poster = join(ROOT, 'public/media', slug, 'poster.jpg');
  if (!existsSync(poster)) continue;
  for (const width of [640, 960, 1280]) {
    const out = join(ROOT, 'public/media', slug, `poster-${width}.webp`);
    await sharp(poster).resize({ width }).webp({ quality: 78 }).toFile(out);
    derived.push(`${slug}/poster-${width}.webp`);
  }
}
// 800px screenshot variants for the gallery grid; the lightbox keeps the 1600px originals.
for (const slug of SLUGS) {
  const manifest = JSON.parse(readFileSync(join(EXPORTS, slug, 'manifest.json'), 'utf8'));
  for (const rel of manifest.files.screenshots ?? []) {
    const src = join(ROOT, 'public/media', slug, rel);
    const out = src.replace(/\.webp$/, '-800.webp');
    await sharp(src).resize({ width: 800 }).webp({ quality: 80 }).toFile(out);
    derived.push(`${slug}/${rel.replace(/\.webp$/, '-800.webp')}`);
  }
}

console.table(rows);
console.log(`Derived ${derived.length} poster variants: ${derived.join(', ')}`);
console.log(mismatches ? `${mismatches} hash mismatch(es)!` : `All ${rows.filter((r) => r.match === 'OK').length} copied files match their source.`);
if (mismatches) process.exitCode = 1;
