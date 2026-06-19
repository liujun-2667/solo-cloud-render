import type { Vec3 } from "@/types";

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : (v - a) / (b - a);

export const remap = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => lerp(outMin, outMax, clamp(invLerp(inMin, inMax, v), 0, 1));

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp(invLerp(edge0, edge1, x), 0, 1);
  return t * t * (3 - 2 * t);
};

export const degToRad = (d: number): number => (d * Math.PI) / 180;
export const radToDeg = (r: number): number => (r * 180) / Math.PI;

export const lerpVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export const clampVec3 = (v: Vec3, lo: number, hi: number): Vec3 => [
  clamp(v[0], lo, hi),
  clamp(v[1], lo, hi),
  clamp(v[2], lo, hi),
];

export const vec3Length = (v: Vec3): number =>
  Math.hypot(v[0], v[1], v[2]);

export const normalizeVec3 = (v: Vec3): Vec3 => {
  const len = vec3Length(v);
  return len > 1e-9 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 0, 0];
};

export const sunDirection = (azimuthDeg: number, elevationDeg: number): Vec3 => {
  const az = degToRad(azimuthDeg);
  const el = degToRad(elevationDeg);
  const cosEl = Math.cos(el);
  return [
    cosEl * Math.cos(az),
    Math.sin(el),
    cosEl * Math.sin(az),
  ];
};

export const formatNumber = (v: number, digits = 2): string => {
  if (Math.abs(v) >= 1000) return v.toFixed(0);
  if (Math.abs(v) >= 10) return v.toFixed(1);
  return v.toFixed(digits);
};

export const formatTime = (ms: number): string =>
  ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(1)}ms`;
