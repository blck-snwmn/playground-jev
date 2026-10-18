import type { TargetInput } from "./schema";

export type TargetRow = TargetInput & { color: string };
const COLORS = [
  "#c72542",
  "#1756c5",
  "#168344",
  "#8937b5",
  "#e18400",
  "#00a9b6",
  "#ec6aaf",
  "#b9bd00",
  "#232d40",
  "#86562b",
];

// Oklab conversion: https://bottosson.github.io/posts/oklab/
function oklab(color: string) {
  const linear = (offset: number) => {
    const value = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const r = linear(1),
    g = linear(3),
    b = linear(5);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ] as const;
}

export function colorDistance(first: string, second: string) {
  const a = oklab(first),
    b = oklab(second);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function newTarget(rows: TargetRow[]): TargetRow {
  const available = COLORS.filter((color) => !rows.some((row) => row.color === color));
  if (!available.length) throw new Error("No target colors available");
  const nearestDistance = (color: string) =>
    Math.min(...rows.map((row) => colorDistance(color, row.color)));
  // Randomize only the first color; maximize separation from every existing row after that.
  const color =
    rows.length === 0
      ? available[Math.floor(Math.random() * available.length)]!
      : available.reduce((best, candidate) =>
          nearestDistance(candidate) > nearestDistance(best) ? candidate : best,
        );
  return { id: crypto.randomUUID(), question: "", color };
}
