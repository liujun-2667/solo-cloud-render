import { create } from "zustand";
import type { RenderParams } from "@/types";
import { DEFAULT_RENDER_PARAMS } from "@/render/constants";
import { lerp, lerpVec3 } from "@/utils/math";

interface RenderParamState {
  params: RenderParams;
  targetParams: RenderParams;
  transitionStart: RenderParams | null;
  transitionDuration: number;
  transitionElapsed: number;
  isTransitioning: boolean;
  setParam: <K extends keyof RenderParams>(key: K, value: RenderParams[K]) => void;
  setParams: (params: Partial<RenderParams>) => void;
  beginTransition: (target: Partial<RenderParams>, durationMs?: number) => void;
  tickTransition: (dtMs: number) => void;
  reset: () => void;
  loadParams: (params: RenderParams) => void;
}

function mergeParams(base: RenderParams, patch: Partial<RenderParams>): RenderParams {
  const next = { ...base, ...patch };
  if (patch.rayleighCoeff) next.rayleighCoeff = [...patch.rayleighCoeff] as RenderParams["rayleighCoeff"];
  return next;
}

function lerpParams(a: RenderParams, b: RenderParams, t: number): RenderParams {
  return {
    sunAzimuth: lerp(a.sunAzimuth, b.sunAzimuth, t),
    sunElevation: lerp(a.sunElevation, b.sunElevation, t),
    sunIntensity: lerp(a.sunIntensity, b.sunIntensity, t),
    colorTempOverride: t > 0.5 ? b.colorTempOverride : a.colorTempOverride,
    colorTemp: lerp(a.colorTemp, b.colorTemp, t),
    rayleighCoeff: lerpVec3(a.rayleighCoeff, b.rayleighCoeff, t),
    mieCoeff: lerp(a.mieCoeff, b.mieCoeff, t),
    mieG: lerp(a.mieG, b.mieG, t),
    rayleighScaleHeight: lerp(a.rayleighScaleHeight, b.rayleighScaleHeight, t),
    mieScaleHeight: lerp(a.mieScaleHeight, b.mieScaleHeight, t),
    coverage: lerp(a.coverage, b.coverage, t),
    cloudBase: lerp(a.cloudBase, b.cloudBase, t),
    cloudThickness: lerp(a.cloudThickness, b.cloudThickness, t),
    noiseFrequency: lerp(a.noiseFrequency, b.noiseFrequency, t),
    detailStrength: lerp(a.detailStrength, b.detailStrength, t),
    windSpeed: lerp(a.windSpeed, b.windSpeed, t),
    windDirection: lerp(a.windDirection, b.windDirection, t),
    atmosphereSteps: Math.round(lerp(a.atmosphereSteps, b.atmosphereSteps, t)),
    cloudSteps: Math.round(lerp(a.cloudSteps, b.cloudSteps, t)),
    resolutionScale: lerp(a.resolutionScale, b.resolutionScale, t),
  };
}

export const useParamsStore = create<RenderParamState>((set, get) => ({
  params: { ...DEFAULT_RENDER_PARAMS },
  targetParams: { ...DEFAULT_RENDER_PARAMS },
  transitionStart: null,
  transitionDuration: 1000,
  transitionElapsed: 0,
  isTransitioning: false,

  setParam: (key, value) =>
    set((state) => {
      const params = { ...state.params };
      if (key === "rayleighCoeff" && Array.isArray(value)) {
        params.rayleighCoeff = [...value] as RenderParams["rayleighCoeff"];
      } else {
        (params as Record<string, unknown>)[key as string] = value;
      }
      return { params, targetParams: params, isTransitioning: false, transitionStart: null };
    }),

  setParams: (patch) =>
    set((state) => {
      const params = mergeParams(state.params, patch);
      return { params, targetParams: params, isTransitioning: false, transitionStart: null };
    }),

  beginTransition: (target, durationMs = 1000) =>
    set((state) => {
      const start = { ...state.params };
      const targetParams = mergeParams(state.params, target);
      return {
        transitionStart: start,
        targetParams,
        transitionDuration: durationMs,
        transitionElapsed: 0,
        isTransitioning: true,
      };
    }),

  tickTransition: (dtMs) =>
    set((state) => {
      if (!state.isTransitioning || !state.transitionStart) return {};
      const elapsed = state.transitionElapsed + dtMs;
      const t = Math.min(1, elapsed / state.transitionDuration);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const params = lerpParams(state.transitionStart, state.targetParams, eased);
      if (t >= 1) {
        return {
          params: state.targetParams,
          isTransitioning: false,
          transitionStart: null,
          transitionElapsed: 0,
        };
      }
      return { params, transitionElapsed: elapsed };
    }),

  reset: () =>
    set({
      params: { ...DEFAULT_RENDER_PARAMS },
      targetParams: { ...DEFAULT_RENDER_PARAMS },
      isTransitioning: false,
      transitionStart: null,
      transitionElapsed: 0,
    }),

  loadParams: (params) =>
    set({
      params: { ...params, rayleighCoeff: [...params.rayleighCoeff] },
      targetParams: { ...params, rayleighCoeff: [...params.rayleighCoeff] },
      isTransitioning: false,
      transitionStart: null,
      transitionElapsed: 0,
    }),
}));
