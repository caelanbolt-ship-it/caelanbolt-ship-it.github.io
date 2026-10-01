// Open Graph images (1200×630) rendered at build time with satori + resvg,
// using the site's own type, palette and each project's real poster.
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { projects } from '../../data/projects';
import { site } from '../../data/site';

const font = (weight: number) =>
  readFileSync(resolve(`node_modules/@fontsource/schibsted-grotesk/files/schibsted-grotesk-latin-${weight}-normal.woff`));
const fonts = [
  { name: 'Schibsted', data: font(500), weight: 500 as const, style: 'normal' as const },
  { name: 'Schibsted', data: font(700), weight: 700 as const, style: 'normal' as const },
  { name: 'Schibsted', data: font(800), weight: 800 as const, style: 'normal' as const },
];

const poster = async (slug: string) => {
  const jpeg = await sharp(resolve(`public/media/${slug}/poster.jpg`)).resize({ width: 1024 }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString('base64')}`;
};

export const getStaticPaths: GetStaticPaths = () => [
  { params: { slug: 'home' } },
  ...projects.map((p) => ({ params: { slug: p.slug } })),
];

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({ type, props: { style, children } });
const img = (src: string, width: number, height: number, style: Record<string, unknown>): Node => ({ type: 'img', props: { src, width, height, style } });

export const GET: APIRoute = async ({ params }) => {
  const project = projects.find((p) => p.slug === params.slug);
  const eyebrow = project ? project.kicker : site.role;
  const title = project ? project.title : site.name;
  const line = project ? project.tagline : site.statement;
  const image = await poster(project ? project.slug : 'my-crm');

  const tree = h('div', {
    width: '100%', height: '100%', display: 'flex', background: '#0a0c10', color: '#eceff4', fontFamily: 'Schibsted', padding: 64,
  }, [
    h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 560, paddingRight: 40 }, [
      h('div', { display: 'flex', alignItems: 'center', gap: 14, fontSize: 22, fontWeight: 500, color: '#8e97a7' }, [
        h('div', { width: 36, height: 36, borderRadius: 9, background: '#eceff4', color: '#0a0c10', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700 }, 'CH'),
        project ? site.name : 'chartle5.github.io',
      ]),
      h('div', { display: 'flex', flexDirection: 'column' }, [
        h('div', { fontSize: 22, fontWeight: 500, color: '#88a4ff', marginBottom: 18 }, eyebrow),
        h('div', { fontSize: title.length > 18 ? 64 : 84, fontWeight: 800, letterSpacing: -3, lineHeight: 0.98 }, title),
        h('div', { fontSize: 30, fontWeight: 500, color: '#b9c0cc', marginTop: 22, lineHeight: 1.25 }, line),
      ]),
      h('div', { display: 'flex', height: 4, width: 96, background: '#88a4ff', borderRadius: 2 }),
    ]),
    h('div', { display: 'flex', flex: 1, alignItems: 'center' }, [
      img(image, 512, 288, { borderRadius: 18, objectFit: 'cover', border: '1px solid #2b3341' }),
    ]),
  ]);
  const svg = await satori(tree as never, { width: 1200, height: 630, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
