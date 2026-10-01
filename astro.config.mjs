// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const fontDir = './node_modules/@fontsource';

export default defineConfig({
  site: 'https://chartle5.github.io',
  base: '/',
  output: 'static',
  trailingSlash: 'always',
  // The site's CSS is small; inlining it removes a render-blocking round trip.
  build: { inlineStylesheets: 'always' },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Schibsted Grotesk',
      cssVariable: '--font-sans',
      fallbacks: ['system-ui', 'sans-serif'],
      options: {
        variants: [
          {
            weight: '400 900',
            style: 'normal',
            display: 'swap',
            src: [`${fontDir}-variable/schibsted-grotesk/files/schibsted-grotesk-latin-wght-normal.woff2`],
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Martian Mono',
      cssVariable: '--font-mono',
      fallbacks: ['ui-monospace', 'monospace'],
      options: {
        variants: [
          { weight: 400, style: 'normal', display: 'swap', src: [`${fontDir}/martian-mono/files/martian-mono-latin-400-normal.woff2`] },
          { weight: 500, style: 'normal', display: 'swap', src: [`${fontDir}/martian-mono/files/martian-mono-latin-500-normal.woff2`] },
        ],
      },
    },
  ],
});
