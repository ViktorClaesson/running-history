import type { Theme } from './theme';

/**
 * Colour ramps mixed in OKLab, a colour space where equal steps look equal, so the middle
 * of a ramp doesn't go muddy the way mixing RGB does. https://bottosson.github.io/posts/oklab/
 */
type Lab = [number, number, number];

const srgbToLinear = (c: number) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const linearToSrgb = (c: number) => {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
};

export function hexToOklab(hex: string): Lab {
  const h = hex.trim().replace('#', '');
  const r = srgbToLinear(parseInt(h.slice(0, 2), 16));
  const g = srgbToLinear(parseInt(h.slice(2, 4), 16));
  const b = srgbToLinear(parseInt(h.slice(4, 6), 16));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToCss([L, A, B]: Lab): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const r = linearToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s);
  const g = linearToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s);
  const b = linearToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s);
  return `rgb(${r},${g},${b})`;
}

const RAMP_STEPS = 24;

/** RAMP_STEPS + 1 colours from `weak` to `strong`. */
export function ramp(weak: string, strong: string): string[] {
  const a = hexToOklab(weak);
  const b = hexToOklab(strong);
  return Array.from({ length: RAMP_STEPS + 1 }, (_, k) => {
    const t = k / RAMP_STEPS;
    return oklabToCss([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  });
}

/** Per zone, one colour per sub-band, weak → strong (a single sub-band is the strong end). */
export function zoneRamps(theme: Theme, zoneBars: number): string[][] {
  return theme.zoneStrong.map((strong, z) => {
    const full = ramp(theme.zoneWeak[z]!, strong);
    return Array.from(
      { length: zoneBars },
      (_, k) => full[zoneBars === 1 ? RAMP_STEPS : Math.round((k / (zoneBars - 1)) * RAMP_STEPS)]!,
    );
  });
}

/**
 * Standing / Walking / Recovery aren't zones, so no hue; but three identical greys would
 * read as one block. A short fade from the neutral towards endurance's weak blue previews
 * "getting closer to real training".
 */
export function leadColours(theme: Theme): { standing: string; walking: string; recovery: string } {
  const fade = ramp(theme.nocolour, theme.zoneWeak[0]!);
  return { standing: theme.nocolour, walking: fade[8]!, recovery: fade[16]! };
}

/** The eight whole-zone buckets' colours, slowest first: each zone in its strong hue. */
export function bucketColours(theme: Theme): string[] {
  const lead = leadColours(theme);
  return [lead.standing, lead.walking, lead.recovery, ...theme.zoneStrong];
}

/** A workout type's colour: recovery's grey-blue, else its zone's strong hue. */
export function workoutColour(theme: Theme, type: number | null): string {
  if (type === null) return theme.nocolour;
  return type === 0 ? leadColours(theme).recovery : theme.zoneStrong[type - 1]!;
}
