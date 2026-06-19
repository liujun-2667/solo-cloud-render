import { create } from "zustand";
import type { CameraState } from "@/types";
import { DEFAULT_CAMERA } from "@/render/constants";
import { clamp } from "@/utils/math";

interface CameraStoreState {
  camera: CameraState;
  targetCamera: CameraState;
  transitionStart: CameraState | null;
  transitionDuration: number;
  transitionElapsed: number;
  isTransitioning: boolean;
  setAzimuth: (v: number) => void;
  setElevation: (v: number) => void;
  setFov: (v: number) => void;
  setCamera: (patch: Partial<CameraState>) => void;
  rotate: (dAzimuth: number, dElevation: number) => void;
  zoom: (delta: number) => void;
  beginTransition: (target: Partial<CameraState>, durationMs?: number) => void;
  tickTransition: (dtMs: number) => void;
  loadCamera: (camera: CameraState) => void;
  reset: () => void;
}

function lerpCamera(a: CameraState, b: CameraState, t: number): CameraState {
  let azimuth = a.azimuth + (b.azimuth - a.azimuth) * t;
  if (Math.abs(b.azimuth - a.azimuth) > 180) {
    azimuth = a.azimuth + ((b.azimuth - a.azimuth + 540) % 360 - 180) * t;
  }
  return {
    azimuth,
    elevation: a.elevation + (b.elevation - a.elevation) * t,
    fov: a.fov + (b.fov - a.fov) * t,
    distance: a.distance + (b.distance - a.distance) * t,
  };
}

export const useCameraStore = create<CameraStoreState>((set) => ({
  camera: { ...DEFAULT_CAMERA },
  targetCamera: { ...DEFAULT_CAMERA },
  transitionStart: null,
  transitionDuration: 1000,
  transitionElapsed: 0,
  isTransitioning: false,

  setAzimuth: (v) =>
    set((state) => ({
      camera: { ...state.camera, azimuth: ((v % 360) + 360) % 360 },
      targetCamera: { ...state.camera, azimuth: ((v % 360) + 360) % 360 },
      isTransitioning: false,
      transitionStart: null,
    })),
  setElevation: (v) =>
    set((state) => ({
      camera: { ...state.camera, elevation: clamp(v, -85, 85) },
      targetCamera: { ...state.camera, elevation: clamp(v, -85, 85) },
      isTransitioning: false,
      transitionStart: null,
    })),
  setFov: (v) =>
    set((state) => ({
      camera: { ...state.camera, fov: clamp(v, 20, 90) },
      targetCamera: { ...state.camera, fov: clamp(v, 20, 90) },
      isTransitioning: false,
      transitionStart: null,
    })),
  setCamera: (patch) =>
    set((state) => {
      const camera = { ...state.camera, ...patch };
      camera.azimuth = ((camera.azimuth % 360) + 360) % 360;
      camera.elevation = clamp(camera.elevation, -85, 85);
      camera.fov = clamp(camera.fov, 20, 90);
      return { camera, targetCamera: camera, isTransitioning: false, transitionStart: null };
    }),
  rotate: (dAz, dEl) =>
    set((state) => {
      const camera = {
        ...state.camera,
        azimuth: (((state.camera.azimuth + dAz) % 360) + 360) % 360,
        elevation: clamp(state.camera.elevation + dEl, -85, 85),
      };
      return { camera, targetCamera: camera, isTransitioning: false, transitionStart: null };
    }),
  zoom: (delta) =>
    set((state) => {
      const fov = clamp(state.camera.fov + delta, 20, 90);
      const camera = { ...state.camera, fov };
      return { camera, targetCamera: camera, isTransitioning: false, transitionStart: null };
    }),

  beginTransition: (target, durationMs = 1000) =>
    set((state) => ({
      transitionStart: { ...state.camera },
      targetCamera: {
        ...state.camera,
        azimuth: target.azimuth ?? state.camera.azimuth,
        elevation: target.elevation ?? state.camera.elevation,
        fov: target.fov ?? state.camera.fov,
        distance: target.distance ?? state.camera.distance,
      },
      transitionDuration: durationMs,
      transitionElapsed: 0,
      isTransitioning: true,
    })),
  tickTransition: (dtMs) =>
    set((state) => {
      if (!state.isTransitioning || !state.transitionStart) return {};
      const elapsed = state.transitionElapsed + dtMs;
      const t = Math.min(1, elapsed / state.transitionDuration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const camera = lerpCamera(state.transitionStart, state.targetCamera, eased);
      if (t >= 1) {
        return {
          camera: { ...state.targetCamera, azimuth: ((state.targetCamera.azimuth % 360) + 360) % 360 },
          isTransitioning: false,
          transitionStart: null,
          transitionElapsed: 0,
        };
      }
      return { camera, transitionElapsed: elapsed };
    }),
  loadCamera: (camera) =>
    set({
      camera: { ...camera },
      targetCamera: { ...camera },
      isTransitioning: false,
      transitionStart: null,
      transitionElapsed: 0,
    }),
  reset: () =>
    set({
      camera: { ...DEFAULT_CAMERA },
      targetCamera: { ...DEFAULT_CAMERA },
      isTransitioning: false,
      transitionStart: null,
      transitionElapsed: 0,
    }),
}));
