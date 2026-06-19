import type { Vec3 } from "@/types";
import { clamp, lerp, smoothstep } from "./math";

export function colorTempToRGB(kelvin: number): Vec3 {
  const t = kelvin / 100;
  let r: number;
  let g: number;
  let b: number;

  if (t <= 66) {
    r = 255;
    g = clamp(99.4708025861 * Math.log(t) - 161.1195681661, 0, 255);
  } else {
    r = clamp(329.698727446 * Math.pow(t - 60, -0.1332047592), 0, 255);
    g = clamp(288.1221695283 * Math.pow(t - 60, -0.0755148492), 0, 255);
  }

  if (t >= 66) {
    b = 255;
  } else if (t <= 19) {
    b = 0;
  } else {
    b = clamp(138.5177312231 * Math.log(t - 10) - 305.0447927307, 0, 255);
  }

  return [r / 255, g / 255, b / 255];
}

export function sunColorByElevation(elevationDeg: number): { color: Vec3; temp: number } {
  const e = clamp(elevationDeg, -10, 90);
  if (e >= 15) {
    return { color: [1, 1, 1], temp: 6500 };
  }
  if (e >= 0) {
    const t = smoothstep(0, 15, e);
    return {
      color: [
        1,
        lerp(0.62, 1, t),
        lerp(0.30, 1, t),
      ],
      temp: lerp(2400, 6500, t),
    };
  }
  if (e >= -5) {
    const t = smoothstep(-10, 0, e);
    return {
      color: [
        1,
        lerp(0.28, 0.62, t),
        lerp(0.08, 0.30, t),
      ],
      temp: lerp(1600, 2400, t),
    };
  }
  const t = smoothstep(-10, -5, e);
  return {
    color: [
      lerp(0.55, 1, t),
      lerp(0.12, 0.28, t),
      lerp(0.04, 0.08, t),
    ],
    temp: lerp(1200, 1600, t),
  };
}

export function lerpColor(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
