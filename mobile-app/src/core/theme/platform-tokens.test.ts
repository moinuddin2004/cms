/// <reference types="node" />
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { contrastRatio } from './brand';
import { PLATFORM_BRAND_TOKENS } from './platform-tokens';

/**
 * `src/global.css` and `platform-tokens.ts` cannot import each other (one is a
 * stylesheet), so this test keeps the two copies of the platform brand values
 * equal and checks the contrast of every semantic tone (docs/10 M0-05 step 1).
 */
const css = readFileSync(path.resolve(__dirname, '../../global.css'), 'utf8');

const lightBlock = css.slice(css.indexOf('@variant light'), css.indexOf('@variant dark'));
const darkBlock = css.slice(css.indexOf('@variant dark'));

function valueIn(block: string, variable: string): string {
  const match = new RegExp(String.raw`${variable}:\s*([^;]+);`).exec(block);
  if (!match) throw new Error(`Missing ${variable} in src/global.css`);
  return match[1].trim();
}

describe('platform brand tokens', () => {
  it('match the light values in src/global.css', () => {
    for (const [variable, value] of Object.entries(PLATFORM_BRAND_TOKENS.light)) {
      expect(valueIn(lightBlock, variable)).toBe(value);
    }
  });

  it('match the dark values in src/global.css', () => {
    for (const [variable, value] of Object.entries(PLATFORM_BRAND_TOKENS.dark)) {
      expect(valueIn(darkBlock, variable)).toBe(value);
    }
  });

  it.each([
    ['light', lightBlock],
    ['dark', darkBlock],
  ])('keeps the primary readable in %s mode', (_mode, block) => {
    const primary = valueIn(block, '--color-primary');
    const foreground = valueIn(block, '--color-primary-foreground');

    expect(contrastRatio(primary, foreground)).toBeGreaterThanOrEqual(4.5);
  });

  it.each([
    ['light', lightBlock],
    ['dark', darkBlock],
  ])('keeps every semantic tone readable in %s mode', (_mode, block) => {
    for (const tone of ['success', 'warning', 'info']) {
      const background = valueIn(block, `--color-${tone}`);
      const foreground = valueIn(block, `--color-${tone}-foreground`);

      expect(contrastRatio(background, foreground)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
