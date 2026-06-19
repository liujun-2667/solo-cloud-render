import type { CameraState } from "@/types";
import { degToRad, clamp } from "@/utils/math";

export class OrbitCamera {
  azimuth: number;
  elevation: number;
  fov: number;
  distance: number;
  eyeHeight: number;

  constructor(state: CameraState, eyeHeight = 1.6) {
    this.azimuth = state.azimuth;
    this.elevation = state.elevation;
    this.fov = state.fov;
    this.distance = state.distance;
    this.eyeHeight = eyeHeight;
  }

  apply(state: CameraState): void {
    this.azimuth = state.azimuth;
    this.elevation = clamp(state.elevation, -89, 89);
    this.fov = clamp(state.fov, 20, 90);
    this.distance = state.distance;
  }

  get position(): [number, number, number] {
    return [0, this.eyeHeight, 0];
  }

  forward(): [number, number, number] {
    const yaw = degToRad(this.azimuth);
    const pitch = degToRad(this.elevation);
    const cp = Math.cos(pitch);
    return [Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp];
  }

  basis(): { forward: [number, number, number]; right: [number, number, number]; up: [number, number, number] } {
    const f = this.forward();
    const worldUp: [number, number, number] = [0, 1, 0];
    let right = cross(f, worldUp);
    right = normalize(right);
    const up = cross(right, f);
    return { forward: f, right, up };
  }

  tanHalfFov(): number {
    return Math.tan(degToRad(this.fov) * 0.5);
  }
}

function cross(a: number[], b: number[]): [number, number, number] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize(v: number[]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]);
  if (len < 1e-9) return [0, 0, 0];
  return [v[0] / len, v[1] / len, v[2] / len];
}
