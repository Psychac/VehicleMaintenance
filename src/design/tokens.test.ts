import { describe, expect, it } from 'vitest';
import { SPACE, buildTokenCss, colors, radius, springToLinear, springs, type Palette } from './tokens';

type RGB = [number, number, number];

/** Parses `#rrggbb` or `rgb(r g b / a)` and composites it over `under`. */
function resolve(css: string, under: RGB = [255, 255, 255]): RGB {
  if (css.startsWith('#')) return [1, 3, 5].map((i) => parseInt(css.slice(i, i + 2), 16)) as RGB;
  const m = css.match(/rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)/);
  if (!m) throw new Error(`unparseable colour ${css}`);
  const a = m[4] === undefined ? 1 : Number(m[4]);
  return [1, 2, 3].map((i, k) => Math.round(Number(m[i]) * a + under[k] * (1 - a))) as RGB;
}

const lum = ([r, g, b]: RGB) => {
  const [R, G, B] = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const contrast = (fg: RGB, bg: RGB) => {
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

function ratio(p: Palette, fg: keyof Palette, bg: keyof Palette): number {
  const base = resolve(p[bg]);
  return contrast(resolve(p[fg], base), base);
}

describe.each([
  ['light', colors.light],
  ['dark', colors.dark],
] as const)('%s palette contrast (WCAG AA)', (_name, p) => {
  const surfaces: (keyof Palette)[] = ['bgPrimary', 'bgGrouped', 'bgElevated', 'bgElevated2'];

  it.each(surfaces)('text roles pass 4.5:1 on %s', (bg) => {
    for (const fg of ['labelPrimary', 'labelSecondary', 'accent', 'success', 'warning', 'destructive'] as const) {
      expect(ratio(p, fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('text on filled controls passes 4.5:1', () => {
    expect(ratio(p, 'accentFg', 'accent')).toBeGreaterThanOrEqual(4.5);
    expect(ratio(p, 'destructiveFg', 'destructive')).toBeGreaterThanOrEqual(4.5);
  });

  it('status text on its own tint (over elevated) passes 4.5:1', () => {
    const under = resolve(p.bgElevated);
    for (const [fg, tint] of [
      ['accent', 'accentTint'],
      ['success', 'successTint'],
      ['warning', 'warningTint'],
      ['destructive', 'destructiveTint'],
    ] as const) {
      const bg = resolve(p[tint], under);
      expect(contrast(resolve(p[fg]), bg), `${fg} on ${tint}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('chart series and accent reach 3:1 against the surface (non-text)', () => {
    for (const fg of ['accent', 'chartOther'] as const) {
      expect(ratio(p, fg, 'bgElevated'), fg).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('scales', () => {
  it('spacing is on the 4-pt grid (2 is the only half-step)', () => {
    for (const s of SPACE) expect(s === 2 || s % 4 === 0).toBe(true);
  });

  it('radius tokens match the spec', () => {
    expect(radius).toEqual({ xs: 6, sm: 10, md: 14, lg: 20, xl: 28, full: 9999 });
  });
});

describe('springToLinear', () => {
  it.each(Object.entries(springs))('%s settles quickly and ends at 1', (_k, s) => {
    const { easing, ms } = springToLinear(s.stiffness, s.damping);
    expect(ms).toBeGreaterThan(50);
    expect(ms).toBeLessThanOrEqual(1500);
    expect(easing).toMatch(/^linear\(0, .*, 1\)$/);
  });

  it('only bouncy overshoots more than 1%, and never beyond ~5% at press/snappy/smooth', () => {
    const peak = (k: keyof typeof springs) =>
      Math.max(...springToLinear(springs[k].stiffness, springs[k].damping).easing.match(/[\d.]+/g)!.map(Number));
    expect(peak('press')).toBeLessThan(1.01);
    expect(peak('snappy')).toBeLessThan(1.05);
    expect(peak('smooth')).toBeLessThan(1.05);
  });
});

describe('buildTokenCss', () => {
  const css = buildTokenCss();

  it('emits light, dark (media + manual) and reduced-motion blocks', () => {
    expect(css).toContain('--color-accent:#1F6B73');
    expect(css).toContain('--color-accent:#5BB5BD');
    expect(css).toContain('prefers-color-scheme:dark');
    expect(css).toContain(':root[data-theme="dark"]');
    expect(css).toContain('prefers-reduced-motion:reduce');
    expect(css).toContain('prefers-reduced-transparency:reduce');
  });

  it('emits every token family', () => {
    for (const v of [
      '--type-body:',
      '--tracking-body:',
      '--space-16:',
      '--radius-md:',
      '--shadow-raised:',
      '--spring-smooth:',
      '--fade-fast:',
      '--material-bar:',
      '.t-large-title',
      '.tnum',
    ]) {
      expect(css, v).toContain(v);
    }
  });

  it('has balanced braces', () => {
    expect((css.match(/{/g) ?? []).length).toBe((css.match(/}/g) ?? []).length);
  });
});
