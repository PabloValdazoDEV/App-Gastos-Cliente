import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const readProjectFile = (path) => readFile(resolve(process.cwd(), path), 'utf8');

describe('PWA configuration', () => {
  it('declares standalone installation with iPhone home-screen metadata', async () => {
    const [indexHtml, manifestText] = await Promise.all([
      readProjectFile('index.html'),
      readProjectFile('public/manifest.webmanifest'),
    ]);
    const manifest = JSON.parse(manifestText);

    expect(manifest).toMatchObject({
      display: 'standalone',
      name: 'BudgetApp',
      start_url: '/dashboard',
    });
    expect(manifest.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', type: 'image/png' }),
        expect.objectContaining({ sizes: '512x512', type: 'image/png' }),
      ]),
    );
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable" content="yes"');
    expect(indexHtml).toContain('rel="apple-touch-icon" sizes="180x180"');
    expect(indexHtml).toContain('rel="manifest" href="/manifest.webmanifest"');
  });
});
