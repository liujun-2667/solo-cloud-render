import { create } from "zustand";
import type { RenderParams, Keyframe } from "@/types";
import { DEFAULT_RENDER_PARAMS } from "@/render/constants";
import { lerpParams } from "./renderParams";
import { clamp, lerp } from "@/utils/math";

const PLAYBACK_SPEEDS = [1, 2, 4, 8];
const HOURS_PER_SECOND = 1;

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function getDefaultWeatherParams(timeHours: number): Partial<RenderParams> {
  const t = timeHours;

  let sunElevation: number;
  let sunAzimuth: number;

  if (t < 6 || t > 18) {
    sunElevation = -10;
    sunAzimuth = t < 6 ? 0 : 180;
  } else {
    const dayT = (t - 6) / 12;
    sunElevation = Math.sin(dayT * Math.PI) * 70 - 5;
    sunAzimuth = 90 + (dayT - 0.5) * 180;
  }

  let coverage: number;
  if (t < 6) {
    coverage = 0.1;
  } else if (t < 9) {
    const morningT = (t - 6) / 3;
    coverage = 0.6 - morningT * 0.45;
  } else if (t < 14) {
    const midT = (t - 9) / 5;
    coverage = 0.15 + midT * 0.4;
  } else if (t < 18) {
    const eveningT = (t - 14) / 4;
    coverage = 0.55 - eveningT * 0.4;
  } else {
    coverage = 0.1;
  }

  let windSpeed: number;
  if (t < 6) {
    windSpeed = 0.2;
  } else if (t < 12) {
    const morningT = (t - 6) / 6;
    windSpeed = 0.2 + morningT * 0.5;
  } else if (t < 18) {
    const eveningT = (t - 12) / 6;
    windSpeed = 0.7 - eveningT * 0.35;
  } else {
    windSpeed = 0.2;
  }

  const sunIntensity = sunElevation > 0
    ? Math.max(5, Math.sin((sunElevation / 90) * Math.PI * 0.5) * 28)
    : 2;

  return {
    sunAzimuth: clamp(sunAzimuth, 0, 360),
    sunElevation: clamp(sunElevation, -10, 90),
    sunIntensity,
    coverage: clamp(coverage, 0, 1),
    windSpeed: clamp(windSpeed, 0, 3),
  };
}

interface TimelineStore {
  currentTime: number;
  isPlaying: boolean;
  playbackSpeedIndex: number;
  keyframes: Keyframe[];
  useWeatherPreset: boolean;

  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlaying: () => void;
  cyclePlaybackSpeed: () => void;
  addKeyframe: (time?: number, params?: RenderParams) => void;
  removeKeyframe: (id: string) => void;
  setUseWeatherPreset: (v: boolean) => void;
  tick: (dtMs: number, currentParams: RenderParams) => RenderParams | null;
  getInterpolatedParams: (time: number, baseParams: RenderParams) => RenderParams;
  reset: () => void;
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  currentTime: 12,
  isPlaying: false,
  playbackSpeedIndex: 0,
  keyframes: [],
  useWeatherPreset: true,

  setCurrentTime: (time) => {
    set({ currentTime: clamp(time, 0, 24) });
  },

  setPlaying: (playing) => set({ isPlaying: playing }),

  togglePlaying: () => set((s) => ({ isPlaying: !s.isPlaying })),

  cyclePlaybackSpeed: () =>
    set((s) => ({
      playbackSpeedIndex: (s.playbackSpeedIndex + 1) % PLAYBACK_SPEEDS.length,
    })),

  addKeyframe: (time, params) => {
    const t = time !== undefined ? time : get().currentTime;
    let p: RenderParams;
    if (params) {
      p = params;
    } else {
      const paramState = useParamsStore.getState();
      p = paramState.params;
    }
    const kf: Keyframe = { id: generateId(), time: clamp(t, 0, 24), params: { ...p, rayleighCoeff: [...p.rayleighCoeff] as [number, number, number] } };
    set((s) => {
      const newKeyframes = [...s.keyframes, kf].sort((a, b) => a.time - b.time);
      return { keyframes: newKeyframes };
    });
  },

  removeKeyframe: (id) =>
    set((s) => ({ keyframes: s.keyframes.filter((k) => k.id !== id) })),

  setUseWeatherPreset: (v) => set({ useWeatherPreset: v }),

  tick: (dtMs, currentParams) => {
    const state = get();
    if (!state.isPlaying) return null;

    const speed = PLAYBACK_SPEEDS[state.playbackSpeedIndex];
    const dtHours = (dtMs / 1000) * HOURS_PER_SECOND * speed;
    let newTime = state.currentTime + dtHours;

    if (newTime >= 24) newTime -= 24;
    if (newTime < 0) newTime += 24;

    set({ currentTime: newTime });

    return state.getInterpolatedParams(newTime, currentParams);
  },

  getInterpolatedParams: (time, baseParams) => {
    const state = get();
    let result: RenderParams = { ...baseParams, rayleighCoeff: [...baseParams.rayleighCoeff] as [number, number, number] };

    if (state.useWeatherPreset) {
      const weather = getDefaultWeatherParams(time);
      result = { ...result, ...weather };
    }

    if (state.keyframes.length === 0) {
      return result;
    }

    const kfs = [...state.keyframes].sort((a, b) => a.time - b.time);

    let before: Keyframe | null = null;
    let after: Keyframe | null = null;

    for (let i = 0; i < kfs.length; i++) {
      if (kfs[i].time <= time) {
        before = kfs[i];
      }
      if (kfs[i].time > time && after === null) {
        after = kfs[i];
      }
    }

    if (before === null && after === null) return result;
    if (before !== null && after === null) return before.params;
    if (before === null && after !== null) return after.params;

    const t = (time - before!.time) / (after!.time - before!.time);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return lerpParams(before!.params, after!.params, eased);
  },

  reset: () =>
    set({
      currentTime: 12,
      isPlaying: false,
      playbackSpeedIndex: 0,
      keyframes: [],
      useWeatherPreset: true,
    }),
}));

export { PLAYBACK_SPEEDS, getDefaultWeatherParams };
