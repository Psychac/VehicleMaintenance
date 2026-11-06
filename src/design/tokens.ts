/**
 * Design tokens: the single source of truth for every visual and motion value (DESIGN.md S3 and S5).
 *
 * Components and screens must not contain raw colours, font sizes, spacing, radii, shadows or
 * durations. They use the CSS variables this file emits (`var(--space-16)`, `var(--color-accent)`,
 * `var(--spring-smooth)` …) or, for JS-driven motion, the typed exports below (`spring.smooth`).
 *
 * `installTokens()` writes the variables into one <style> tag before React renders, so there is no
 * flash and no second file to keep in sync. `buildTokenCss()` is pure so it can be tested.
 *
 * Not expressible as variables (CSS limitation): media-query breakpoints. Use `breakpoints` below
 * as the documented values.
 */

/* ------------------------------------------------------------------ */
/* Spacing (S3.3): 4-pt grid                                           */
/* ------------------------------------------------------------------ */

export const SPACE = [2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80] as const;

export const layout = {
  /** Minimum tappable size, even when the visible control is smaller. */
  hit: 44,
  marginCompact: 16,
  marginRegular: 20,
  /** Readable column on tablet / small windows. */
  readable: 672,
  sidebar: 280,
  tabBar: 56,
  navBar: 52,
  buttonLarge: 50,
  buttonRegular: 44,
  input: 48,
  rowMin: 44,
} as const;

/** Documented media-query breakpoints (px). Variables can't be used inside `@media`. */
export const breakpoints = {
  /** Regular phone: 20 margins. */
  regularPhone: 390,
  /** Tablet portrait / small window: readable column. */
  tablet: 600,
  /** Desktop: sidebar + content. */
  desktop: 900,
} as const;

/* ------------------------------------------------------------------ */
/* Radius (S3.4)                                                       */
/* ------------------------------------------------------------------ */

export const radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, full: 9999 } as const;

/* ------------------------------------------------------------------ */
/* Typography (S3.1): one system family, scaled in rem for user zoom   */
/* ------------------------------------------------------------------ */

const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, "Segoe UI", Roboto, "Helvetica Neue", sans-serif';
const FONT_MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

/** [size px, line-height px, weight, tracking em] */
export const type = {
  largeTitle: [34, 41, 700, -0.005],
  title1: [28, 34, 700, -0.004],
  title2: [22, 28, 700, -0.003],
  title3: [20, 25, 600, -0.002],
  headline: [17, 22, 600, -0.004],
  body: [17, 22, 400, -0.004],
  callout: [16, 21, 400, -0.003],
  subhead: [15, 20, 400, -0.002],
  footnote: [13, 18, 400, -0.001],
  caption: [12, 16, 500, 0],
  caption2: [11, 13, 500, 0.001],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export type TypeToken = keyof typeof type;

/* ------------------------------------------------------------------ */
/* Colour (S3.2): semantic roles, light + dark                         */
/* ------------------------------------------------------------------ */
/*
 * Accent: petrol teal. Neutrals are tinted warm (hue ~80, 2-4% saturation) so greys read as
 * paper and graphite rather than dead grey. Status colours are tuned away from the accent hue:
 * success leans yellow-green, warning amber, destructive warm red.
 *
 * Deviation from S3.2: label.secondary is 78% (light) / 62% (dark) instead of 60% so it clears
 * WCAG AA 4.5:1 on every surface (verified in tokens.test.ts). Placeholders reuse secondary;
 * tertiary (30%) is for chevrons and disabled content only, which AA exempts.
 */

export interface Palette {
  bgPrimary: string;
  bgGrouped: string;
  bgElevated: string;
  bgElevated2: string;
  labelPrimary: string;
  labelSecondary: string;
  labelTertiary: string;
  separator: string;
  accent: string;
  accentFg: string;
  accentTint: string;
  success: string;
  successTint: string;
  warning: string;
  warningTint: string;
  destructive: string;
  destructiveFg: string;
  destructiveTint: string;
  /** Non-text series colour for the second chart series (fuel uses accent). */
  chartOther: string;
  scrim: string;
  /** Highlight fill for a pressed row (label colour at ~7%). */
  pressFill: string;
}

export const colors: { light: Palette; dark: Palette } = {
  light: {
    bgPrimary: '#FBFAF7',
    bgGrouped: '#F3F1EC',
    bgElevated: '#FFFFFF',
    bgElevated2: '#F3F1EC',
    labelPrimary: 'rgb(28 27 24 / 0.92)',
    labelSecondary: 'rgb(60 58 52 / 0.78)',
    labelTertiary: 'rgb(60 58 52 / 0.30)',
    separator: 'rgb(60 58 52 / 0.29)',
    accent: '#1F6B73',
    accentFg: '#FFFFFF',
    accentTint: 'rgb(31 107 115 / 0.12)',
    success: '#366D1C',
    successTint: 'rgb(54 109 28 / 0.13)',
    warning: '#9A5A00',
    warningTint: 'rgb(154 90 0 / 0.13)',
    destructive: '#BC2E25',
    destructiveFg: '#FFFFFF',
    destructiveTint: 'rgb(188 46 37 / 0.12)',
    chartOther: '#8A867C',
    scrim: 'rgb(20 18 14 / 0.40)',
    pressFill: 'rgb(28 27 24 / 0.07)',
  },
  dark: {
    bgPrimary: '#121211',
    bgGrouped: '#0B0B0A',
    bgElevated: '#1D1C1A',
    bgElevated2: '#2A2926',
    labelPrimary: 'rgb(255 252 246 / 0.96)',
    labelSecondary: 'rgb(235 232 222 / 0.62)',
    labelTertiary: 'rgb(235 232 222 / 0.30)',
    separator: 'rgb(84 82 76 / 0.60)',
    accent: '#5BB5BD',
    accentFg: '#08191B',
    accentTint: 'rgb(91 181 189 / 0.16)',
    success: '#8CCB5E',
    successTint: 'rgb(140 203 94 / 0.16)',
    warning: '#FFB340',
    warningTint: 'rgb(255 179 64 / 0.16)',
    destructive: '#FF6B60',
    destructiveFg: '#1A0604',
    destructiveTint: 'rgb(255 107 96 / 0.16)',
    chartOther: '#8D8A80',
    scrim: 'rgb(0 0 0 / 0.40)',
    pressFill: 'rgb(255 252 246 / 0.08)',
  },
};

/* ------------------------------------------------------------------ */
/* Elevation and materials (S3.5): base, raised, overlay               */
/* ------------------------------------------------------------------ */

/** Shadow tint: warm, never pure black at high opacity. */
const SHADOW_TINT = '40 34 20';

const elevation = {
  light: {
    base: 'none',
    raised: `0 1px 2px rgb(${SHADOW_TINT} / 0.04), 0 4px 12px rgb(${SHADOW_TINT} / 0.06)`,
    overlay: `0 8px 24px rgb(${SHADOW_TINT} / 0.12), 0 2px 6px rgb(${SHADOW_TINT} / 0.06)`,
  },
  dark: {
    // Dark mode: elevation is lightness; a 0.5pt inner hairline at white 6% replaces the shadow.
    base: 'none',
    raised: 'inset 0 0 0 0.5px rgb(255 255 255 / 0.06)',
    overlay: 'inset 0 0 0 0.5px rgb(255 255 255 / 0.06), 0 8px 24px rgb(0 0 0 / 0.40)',
  },
} as const;

const material = {
  light: { bar: 'rgb(251 250 247 / 0.78)', barSolid: '#FBFAF7' },
  dark: { bar: 'rgb(18 18 17 / 0.72)', barSolid: '#121211' },
} as const;

const MATERIAL_FILTER = 'blur(20px) saturate(180%)';

export const zIndex = { base: 0, bar: 10, sheet: 30, toast: 40 } as const;

/** Icons: one family, one stroke weight (S3.6). */
export const icon = { stroke: 1.5, sm: 18, md: 22, lg: 28, hero: 56 } as const;

/* ------------------------------------------------------------------ */
/* Motion (S5): springs for movement, timed curves for opacity/colour   */
/* ------------------------------------------------------------------ */

/** Mass-1 stiffness/damping, matching `motion` (Framer Motion) `type: "spring"`. */
export const springs = {
  press: { stiffness: 987, damping: 63 },
  snappy: { stiffness: 439, damping: 38 },
  smooth: { stiffness: 247, damping: 27 },
  gentle: { stiffness: 131, damping: 19 },
  bouncy: { stiffness: 158, damping: 16 },
} as const;

export type SpringToken = keyof typeof springs;

/** Ready-to-spread transition objects for `motion`: `<motion.div transition={spring.smooth} />`. */
export const spring = Object.fromEntries(
  Object.entries(springs).map(([k, v]) => [k, { type: 'spring' as const, ...v, mass: 1 }])
) as { [K in SpringToken]: { type: 'spring'; stiffness: number; damping: number; mass: 1 } };

export const fade = {
  fast: { ms: 120, ease: 'cubic-bezier(0.2, 0, 0, 1)' },
  standard: { ms: 200, ease: 'cubic-bezier(0.2, 0, 0, 1)' },
  exit: { ms: 150, ease: 'cubic-bezier(0.4, 0, 1, 1)' },
  colorState: { ms: 180, ease: 'cubic-bezier(0.4, 0, 0.2, 1)' },
} as const;

/** Press, enter and exit values (S5.3, S6.1). */
export const motionValues = {
  pressScaleButton: 0.97,
  pressScaleCard: 0.98,
  pressScaleIcon: 0.88,
  pressDimIcon: 0.6,
  /** Primary/secondary button brightness while pressed. */
  pressBrightness: 0.92,
  enterScale: 0.96,
  exitScale: 0.96,
  /** Enter offsets are 8-24pt, not whole screens. */
  enterOffsetSm: 8,
  enterOffsetMd: 16,
  enterOffsetLg: 24,
  staggerMs: 25,
  staggerMax: 6,
  /** Skeleton: delay before showing (S8: nothing under ~300 ms) and shimmer loop. */
  loadingDelayMs: 300,
  shimmerMs: 1200,
  toastMs: 4000,
  undoMs: 5000,
  /** Reduce Motion crossfade replaces slides and zooms (S5.6). */
  reducedFadeMs: 200,
} as const;

/** Haptic semantics (S6.3). Patterns are `navigator.vibrate` ms; consumed by `haptics.ts` in step 3. */
export const haptics = {
  selection: [4],
  impactLight: [8],
  impactMedium: [14],
  impactSoft: [6],
  success: [10, 40, 12],
  warning: [14, 50, 14],
  error: [18, 40, 18, 40, 18],
  /** Never two haptics within this window. */
  minGapMs: 100,
} as const;

export const shake = { cycles: 3, distance: 6, ms: 300 } as const;

/**
 * Converts a mass-1 spring into a CSS `linear()` easing plus its settle time, so CSS-driven states
 * (press, toggles) use the same physics as `motion`-driven ones. Overshoot is preserved.
 */
export function springToLinear(stiffness: number, damping: number): { easing: string; ms: number } {
  const w0 = Math.sqrt(stiffness);
  const z = damping / (2 * Math.sqrt(stiffness));
  const x = (t: number): number => {
    if (Math.abs(z - 1) < 1e-3) return 1 - Math.exp(-w0 * t) * (1 + w0 * t);
    if (z < 1) {
      const wd = w0 * Math.sqrt(1 - z * z);
      return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0) / wd) * Math.sin(wd * t));
    }
    const s = Math.sqrt(z * z - 1);
    const r1 = -w0 * (z - s);
    const r2 = -w0 * (z + s);
    return 1 - (r2 * Math.exp(r1 * t) - r1 * Math.exp(r2 * t)) / (r2 - r1);
  };
  // Settle time: last instant the curve is more than 0.2% from the target.
  let settle = 0.05;
  for (let t = 0; t < 3; t += 0.001) if (Math.abs(x(t) - 1) > 0.002) settle = t;
  const points = Math.max(12, Math.min(48, Math.round(settle * 80)));
  const samples = Array.from({ length: points }, (_, i) => +x(((i + 1) / points) * settle).toFixed(3));
  samples[samples.length - 1] = 1;
  return { easing: `linear(0, ${samples.join(', ')})`, ms: Math.round(settle * 1000) };
}

/* ------------------------------------------------------------------ */
/* CSS generation                                                       */
/* ------------------------------------------------------------------ */

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase());
const rem = (px: number) => `${+(px / 16).toFixed(4)}rem`;

function paletteVars(
  p: Palette,
  e: { base: string; raised: string; overlay: string },
  m: { bar: string; barSolid: string }
): string {
  const lines = Object.entries(p).map(([k, v]) => `--color-${kebab(k)}:${v};`);
  lines.push(`--shadow-base:${e.base};`, `--shadow-raised:${e.raised};`, `--shadow-overlay:${e.overlay};`);
  lines.push(`--material-bar:${m.bar};`, `--material-bar-solid:${m.barSolid};`);
  return lines.join('');
}

export function buildTokenCss(): string {
  const root: string[] = [];

  root.push(`--font-sans:${FONT_SANS};--font-mono:${FONT_MONO};`);
  for (const [name, [size, line, weight, track]] of Object.entries(type)) {
    const n = kebab(name);
    root.push(
      `--type-${n}:${weight} ${rem(size)}/${rem(line)} var(--font-sans);--tracking-${n}:${track}em;`
    );
  }

  for (const s of SPACE) root.push(`--space-${s}:${rem(s)};`);
  for (const [k, v] of Object.entries(layout)) root.push(`--layout-${kebab(k)}:${rem(v)};`);
  root.push('--margin-x:var(--layout-margin-compact);');

  for (const [k, v] of Object.entries(radius)) root.push(`--radius-${k}:${k === 'full' ? '9999px' : rem(v)};`);
  root.push('--corner-shape:round;');

  for (const [k, v] of Object.entries(zIndex)) root.push(`--z-${k}:${v};`);
  for (const [k, v] of Object.entries(icon)) root.push(`--icon-${kebab(k)}:${k === 'stroke' ? v : rem(v)};`);

  for (const [k, { easing, ms }] of Object.entries(
    Object.fromEntries(Object.entries(springs).map(([n, v]) => [n, springToLinear(v.stiffness, v.damping)]))
  )) {
    root.push(`--spring-${k}:${easing};--spring-${k}-ms:${ms}ms;`);
  }
  for (const [k, v] of Object.entries(fade)) root.push(`--fade-${kebab(k)}:${v.ms}ms ${v.ease};`, `--fade-${kebab(k)}-ms:${v.ms}ms;`);
  root.push(`--ease-fade:${fade.standard.ease};`);

  for (const [k, v] of Object.entries(motionValues)) {
    const unit = /Ms$/.test(k) ? 'ms' : /^enterOffset/.test(k) ? 'px' : '';
    root.push(`--motion-${kebab(k)}:${v}${unit};`);
  }
  root.push('--motion-distance:1;', '--opacity-disabled:0.4;', `--shake-distance:${shake.distance}px;--shake-ms:${shake.ms}ms;`);
  root.push('--hairline:1px;', '--focus-width:2px;', '--focus-offset:2px;', `--material-filter:${MATERIAL_FILTER};`);

  const light = paletteVars(colors.light, elevation.light, material.light);
  const dark = paletteVars(colors.dark, elevation.dark, material.dark);

  // Type utility classes: one class sets font + tracking so the pair can't drift apart.
  const typeClasses = Object.keys(type)
    .map((name) => {
      const n = kebab(name);
      return `.t-${n}{font:var(--type-${n});letter-spacing:var(--tracking-${n});}`;
    })
    .join('');

  return [
    `:root{color-scheme:light dark;${root.join('')}${light}}`,
    `@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){color-scheme:dark;${dark}}}`,
    `:root[data-theme="light"]{color-scheme:light;}`,
    `:root[data-theme="dark"]{color-scheme:dark;${dark}}`,
    `@media (min-width:${breakpoints.regularPhone}px){:root{--margin-x:var(--layout-margin-regular);}}`,
    `@media (min-resolution:2dppx){:root{--hairline:0.5px;}}`,
    `@supports (corner-shape:squircle){:root{--corner-shape:squircle;}}`,
    // Reduce Motion (S5.6): slides, zooms and bounce collapse to short crossfades; haptics stay.
    `@media (prefers-reduced-motion:reduce){:root{--motion-distance:0;--motion-enter-scale:1;--motion-exit-scale:1;--motion-stagger-ms:0ms;${Object.keys(springs)
      .map((k) => `--spring-${k}:var(--ease-fade);--spring-${k}-ms:${motionValues.reducedFadeMs}ms;`)
      .join('')}}}`,
    // Reduce Transparency: materials become solid.
    `@media (prefers-reduced-transparency:reduce){:root{--material-bar:var(--material-bar-solid);--material-filter:none;}}`,
    // Increase Contrast: stronger separators and secondary labels.
    `@media (prefers-contrast:more){:root{--color-separator:var(--color-label-secondary);--color-label-secondary:var(--color-label-primary);}}`,
    `.tnum{font-variant-numeric:tabular-nums;}`,
    typeClasses,
  ].join('\n');
}

/** Writes the tokens into <head>. Idempotent. Call before the first React render. */
export function installTokens(): void {
  if (typeof document === 'undefined' || document.getElementById('design-tokens')) return;
  const style = document.createElement('style');
  style.id = 'design-tokens';
  style.textContent = buildTokenCss();
  document.head.prepend(style);
}

/** True when the OS asks for reduced motion. For JS-driven animation (e.g. `motion`). */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
