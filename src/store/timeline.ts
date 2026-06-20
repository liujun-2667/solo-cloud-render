import { create } from "zustand";
import type { RenderParams, Keyframe, WeatherType, RainIntensity } from "@/types";
import { DEFAULT_RENDER_PARAMS } from "@/render/constants";
import { lerpParams } from "./renderParams";
import { useParamsStore } from "./renderParams";
import { clamp } from "@/utils/math";

const PLAYBACK_SPEEDS = [1, 2, 4, 8];
const HOURS_PER_SECOND = 1;

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function getPrecipitationParams(timeHours: number): {
  weatherType: WeatherType;
  rainIntensity: RainIntensity;
  coverage: number;
  windBoost: number;
} {
  const t = timeHours;

  if (t < 5.0) {
    return { weatherType: "clear", rainIntensity: "moderate", coverage: 0.1, windBoost: 0 };
  } else if (t < 6.5) {
    const p = (t - 5.0) / 1.5;
    const eased = smoothStep(0, 1, p);
    return {
      weatherType: "rain",
      rainIntensity: "light",
      coverage: 0.5 + eased * 0.2,
      windBoost: eased * 0.1,
    };
  } else if (t < 8.0) {
    const p = (t - 6.5) / 1.5;
    const eased = smoothStep(0, 1, p);
    return {
      weatherType: "rain",
      rainIntensity: eased < 0.5 ? "light" : "moderate",
      coverage: 0.7 + eased * 0.15,
      windBoost: 0.1 + eased * 0.15,
    };
  } else if (t < 10.0) {
    const p = (t - 8.0) / 2.0;
    const eased = smoothStep(0, 1, p);
    return {
      weatherType: "rain",
      rainIntensity: eased < 0.5 ? "moderate" : "heavy",
      coverage: 0.85,
      windBoost: 0.25 + eased * 0.15,
    };
  } else if (t < 12.0) {
    const p = (t - 10.0) / 2.0;
    const eased = smoothStep(0, 1, p);
    return {
      weatherType: "rain",
      rainIntensity: "storm",
      coverage: 0.9,
      windBoost: 0.4 + eased * 0.1,
    };
  } else if (t < 13.5) {
    const p = (t - 12.0) / 1.5;
    const eased = smoothStep(0, 1, p);
    return {
      weatherType: "rain",
      rainIntensity: eased < 0.5 ? "storm" : "heavy",
      coverage: 0.9 - eased * 0.15,
      windBoost: 0.5 - eased * 0.2,
    };
  } else if (t < 15.0) {
    const p = (t - 13.5) / 1.5;
    const eased = smoothStep(0, 1, p);
    return {
      weatherType: "rain",
      rainIntensity: eased < 0.5 ? "heavy" : "light",
      coverage: 0.75 - eased * 0.35,
      windBoost: 0.3 - eased * 0.2,
    };
  } else if (t < 16.5) {
    const p = (t - 15.0) / 1.5;
    const eased = smoothStep(0, 1, p);
    return {
      weatherType: "snow",
      rainIntensity: "moderate",
      coverage: 0.5 + eased * 0.1,
      windBoost: 0.15 + eased * 0.1,
    };
  } else if (t < 18.0) {
    const p = (t - 16.5) / 1.5;
    const eased = smoothStep(0, 1, p);
    return {
      weatherType: "snow",
      rainIntensity: "moderate",
      coverage: 0.6 - eased * 0.2,
      windBoost: 0.25 - eased * 0.15,
    };
  } else {
    return { weatherType: "clear", rainIntensity: "moderate", coverage: 0.1, windBoost: 0 };
  }
}

function getDefaultWeatherParams(timeHours: number): Partial<RenderParams> {
  const t = timeHours;

  let sunElevation: number;
  let sunAzimuth: number;

  const sunriseStart = 5.0;
  const sunriseEnd = 7.5;
  const sunsetStart = 16.5;
  const sunsetEnd = 19.0;

  if (t <= sunriseStart) {
    sunElevation = -10;
    sunAzimuth = 45;
  } else if (t < sunriseEnd) {
    const sunriseT = (t - sunriseStart) / (sunriseEnd - sunriseStart);
    const eased = smoothStep(0, 1, sunriseT);
    sunElevation = -10 + eased * 30;
    sunAzimuth = 45 + eased * 45;
  } else if (t <= sunsetStart) {
    const dayT = (t - sunriseEnd) / (sunsetStart - sunriseEnd);
    sunElevation = 20 + Math.sin(dayT * Math.PI) * 45;
    sunAzimuth = 90 + dayT * 180;
  } else if (t < sunsetEnd) {
    const sunsetT = (t - sunsetStart) / (sunsetEnd - sunsetStart);
    const eased = smoothStep(0, 1, sunsetT);
    sunElevation = 20 - eased * 30;
    sunAzimuth = 270 + eased * 45;
  } else {
    sunElevation = -10;
    sunAzimuth = 315;
  }

  const precip = getPrecipitationParams(t);

  let windSpeed: number;
  if (t < 6) {
    windSpeed = 0.2;
  } else if (t < 12) {
    const morningT = (t - 6) / 6;
    const eased = smoothStep(0, 1, morningT);
    windSpeed = 0.2 + eased * 0.5;
  } else if (t < 18) {
    const eveningT = (t - 12) / 6;
    const eased = smoothStep(0, 1, eveningT);
    windSpeed = 0.7 - eased * 0.35;
  } else {
    windSpeed = 0.2;
  }
  windSpeed = clamp(windSpeed + precip.windBoost, 0, 3);

  let sunIntensity: number;
  if (sunElevation <= 0) {
    sunIntensity = 2;
  } else if (sunElevation < 10) {
    const lowT = sunElevation / 10;
    sunIntensity = 2 + lowT * 10;
  } else {
    sunIntensity = Math.max(12, Math.sin((sunElevation / 90) * Math.PI * 0.5) * 28);
  }
  sunIntensity *= 1.0 - precip.coverage * 0.5;

  return {
    sunAzimuth: clamp(sunAzimuth, 0, 360),
    sunElevation: clamp(sunElevation, -10, 90),
    sunIntensity,
    coverage: clamp(precip.coverage, 0, 1),
    windSpeed: clamp(windSpeed, 0, 3),
    weatherType: precip.weatherType,
    rainIntensity: precip.rainIntensity,
    lightningEnabled: true,
    snowAccumulation: precip.weatherType === "snow" ? 0.5 : 0,
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
    const kf: Keyframe = {
      id: generateId(),
      time: clamp(t, 0, 24),
      params: { ...p, rayleighCoeff: [...p.rayleighCoeff] as [number, number, number] },
    };
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

    if (state.keyframes.length > 0) {
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

      if (before === null && after === null) {
        // No keyframes matching - fall through to weather preset
      } else if (before !== null && after === null) {
        // Time is after last keyframe - hold last keyframe
        return before.params;
      } else if (before === null && after !== null) {
        // Time is before first keyframe - hold first keyframe
        return after.params;
      } else {
        // Between two keyframes - interpolate
        const t = (time - before!.time) / (after!.time - before!.time);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        return lerpParams(before!.params, after!.params, eased);
      }
    }

    let result: RenderParams = {
      ...baseParams,
      rayleighCoeff: [...baseParams.rayleighCoeff] as [number, number, number],
    };

    if (state.useWeatherPreset) {
      const weather = getDefaultWeatherParams(time);
      result = { ...result, ...weather };
    }

    return result;
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
