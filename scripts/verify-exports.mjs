// Read-only verification of the video exports. Never writes to the exports folder.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';

export const EXPORTS = '/Users/caelanhartley/portfolio/exports';
export const SLUGS = ['my-crm', 'golf', 'hush', 'face-detector'];

const MB = 1024 * 1024;
const LIMITS = { walkthrough: 15 * MB, preview: 2 * MB };
const SECRET_PATTERNS = [
  /smutpipeline/i,
  /\bsk-[a-z0-9_-]{16,}/i,
  /\b(api[_-]?key|secret[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]/i,
  /\b[A-Z][A-Z0-9_]{2,}=\S+/, // KEY=value lines from a .env
  /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/, // IPv4
  /localhost|127\.0\.0\.1|:\d{4,5}\b/i,
  /https?:\/\//i,
];

function ffprobe(file) {
  const out = execFileSync('ffprobe', ['-v', 'error', '-show_entries',
    'format=duration:stream=codec_type,codec_name,width,height', '-of', 'json', file]);
  return JSON.parse(out.toString());
}

// +faststart means the moov atom precedes mdat among the top-level boxes.
function isFaststart(file) {
  const fd = openSync(file, 'r');
  const size = statSync(file).size;
  const head = Buffer.alloc(8);
  let pos = 0;
  try {
    while (pos < size) {
      readSync(fd, head, 0, 8, pos);
      let boxSize = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      if (boxSize === 1) {
        const big = Buffer.alloc(8);
        readSync(fd, big, 0, 8, pos + 8);
        boxSize = Number(big.readBigUInt64BE(0));
      }
      if (boxSize < 8) return false;
      pos += boxSize;
    }
  } finally {
    closeSync(fd);
  }
  return false;
}

export function listedFiles(manifest) {
  const f = manifest.files;
  return [f.video, f.preview, f.poster, f.captions, ...(f.screenshots ?? [])];
}

export function verify() {
  const problems = [];
  const rows = [];
  for (const slug of SLUGS) {
    const dir = join(EXPORTS, slug);
    const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
    const all = Object.entries(manifest.files).flatMap(([, v]) => (Array.isArray(v) ? v : [v]));
    const missing = all.filter((p) => !existsSync(join(dir, p)));
    if (missing.length) problems.push(`${slug}: missing ${missing.join(', ')}`);

    for (const kind of ['walkthrough', 'preview']) {
      const file = join(dir, kind === 'walkthrough' ? manifest.files.video : manifest.files.preview);
      const probe = ffprobe(file);
      const v = probe.streams.find((s) => s.codec_type === 'video');
      const audio = probe.streams.some((s) => s.codec_type === 'audio');
      const dur = Number(probe.format.duration);
      const expected = kind === 'walkthrough' ? manifest.duration : manifest.preview?.duration ?? 6;
      const size = statSync(file).size;
      const fast = isFaststart(file);
      const durOk = Math.abs(dur - expected) <= 0.1;
      const row = { slug, kind, codec: v?.codec_name, dims: `${v?.width}x${v?.height}`,
        duration: dur.toFixed(2), expected, audio, sizeMB: (size / MB).toFixed(2), faststart: fast };
      rows.push(row);
      if (v?.codec_name !== 'h264') problems.push(`${slug} ${kind}: codec ${v?.codec_name}`);
      if (!durOk) problems.push(`${slug} ${kind}: duration ${dur} vs manifest ${expected}`);
      if (!fast) problems.push(`${slug} ${kind}: not faststart`);
      if (size > LIMITS[kind]) problems.push(`${slug} ${kind}: ${row.sizeMB} MB over limit`);
      if (kind === 'preview' && audio) problems.push(`${slug} preview has an audio track`);
    }

    const vtt = readFileSync(join(dir, manifest.files.captions), 'utf8');
    if (!vtt.startsWith('WEBVTT')) problems.push(`${slug}: captions missing WEBVTT header`);

    for (const name of ['content.md', 'manifest.json']) {
      const lines = readFileSync(join(dir, name), 'utf8').split('\n');
      lines.forEach((line, i) => {
        for (const re of SECRET_PATTERNS) {
          if (re.test(line)) problems.push(`${slug}/${name}:${i + 1} matches ${re}: ${line.trim().slice(0, 100)}`);
        }
      });
    }
  }
  return { rows, problems };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { rows, problems } = verify();
  console.table(rows);
  if (problems.length) {
    console.log('\nPROBLEMS:');
    problems.forEach((p) => console.log(' - ' + p));
    process.exitCode = 1;
  } else {
    console.log('\nAll exports verified: files present, H.264, durations match, faststart, sizes within limits, no secrets.');
  }
}
