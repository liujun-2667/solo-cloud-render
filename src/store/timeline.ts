import { create } from "zustand";
import type { RenderParams, Keyframe, WeatherType, RainIntensity, WeatherKeyframe } from "@/types";
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

function getWeatherTypeColor(type: WeatherType): string {
  switch (type) {
    case "clear": return "#fbbf24";
    case "rain": return "#3b82f6";
    case "snow": return "#f0f9ff";
    default: return "#fbbf24";
  }
}

function lerpRainIntensity(a: RainIntensity, b: RainIntensity, t: number): RainIntensity {
  const order: RainIntensity[] = ["light", "moderate", "heavy", "storm"];
  const idxA = order.indexOf(a);
  const idxB = order.indexOf(b);
  const idx = Math.round(idxA + (idxB - idxA) * t);
  return order[clamp(idx, 0, order.length - 1)];
}

function lerpWeatherKeyframe(a: WeatherKeyframe, b: WeatherKeyframe, t: number): WeatherKeyframe {
  const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return {
    id: b.id,
    time: b.time,
    weatherType: eased > 0.5 ? b.weatherType : a.weatherType,
    rainIntensity: lerpRainIntensity(a.rainIntensity, b.rainIntensity, eased),
    particleDensityMultiplier: a.particleDensityMultiplier + (b.particleDensityMultiplier - a.particleDensityMultiplier) * eased,
    windParticleInfluence: a.windParticleInfluence + (b.windParticleInfluence - a.windParticleInfluence) * eased,
  };
}

interface TimelineStore {
  currentTime: number;
  isPlaying: boolean;
  playbackSpeedIndex: number;
  keyframes: Keyframe[];
  useWeatherPreset: boolean;

  weatherKeyframes: WeatherKeyframe[];
  useWeatherKeyframes: boolean;
  weatherTransitionDuration: number;
  weatherLocked: boolean;

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

  addWeatherKeyframe: (time?: number, weatherType?: WeatherType, rainIntensity?: RainIntensity, densityMultiplier?: number, windInfluence?: number) => void;
  removeWeatherKeyframe: (id: string) => void;
  updateWeatherKeyframe: (id: string, updates: Partial<WeatherKeyframe>) => void;
  moveWeatherKeyframe: (id: string, newTime: number) => void;
  setUseWeatherKeyframes: (v: boolean) => void;
  setWeatherTransitionDuration: (duration: number) => void;
  setWeatherLocked: (v: boolean) => void;
  getInterpolatedWeather: (time: number) => WeatherKeyframe | null;
  getWeatherCloudOffset: (time: number) => { coverageOffset: number; windMultiplier: number };
}

export const useTimelineStore = create<TimelineStore>((set, get) => ({
  currentTime: 12,
  isPlaying: false,
  playbackSpeedIndex: 0,
  keyframes: [],
  useWeatherPreset: true,

  weatherKeyframes: [],
  useWeatherKeyframes: false,
  weatherTransitionDuration: 3.0,
  weatherLocked: false,

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

    let result: RenderParams = {
      ...baseParams,
      rayleighCoeff: [...baseParams.rayleighCoeff] as [number, number, number],
    };

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

      if (before !== null && after !== null) {
        const t = (time - before.time) / (after.time - before.time);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        result = lerpParams(before.params, after.params, eased);
      } else if (before !== null) {
        result = before.params;
      } else if (after !== null) {
        result = after.params;
      }
    }

    if (state.useWeatherPreset && state.keyframes.length === 0) {
      const weather = getDefaultWeatherParams(time);
      result = { ...result, ...weather };
    }

    if (!state.weatherLocked) {
      const weatherKf = state.getInterpolatedWeather(time);
      if (weatherKf && state.useWeatherKeyframes) {
        result.weatherType = weatherKf.weatherType;
        result.rainIntensity = weatherKf.rainIntensity;
        result.particleDensityMultiplier = weatherKf.particleDensityMultiplier;
        result.windParticleInfluence = weatherKf.windParticleInfluence;
      }
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
      weatherKeyframes: [],
      useWeatherKeyframes: false,
      weatherTransitionDuration: 3.0,
      weatherLocked: false,
    }),

  addWeatherKeyframe: (time, weatherType, rainIntensity, densityMultiplier, windInfluence) => {
    const t = time !== undefined ? time : get().currentTime;
    const params = useParamsStore.getState().params;

    const kf: WeatherKeyframe = {
      id: generateId(),
      time: clamp(t, 0, 24),
      weatherType: weatherType ?? params.weatherType,
      rainIntensity: rainIntensity ?? params.rainIntensity,
      particleDensityMultiplier: densityMultiplier ?? params.particleDensityMultiplier,
      windParticleInfluence: windInfluence ?? params.windParticleInfluence,
    };

    set((s) => {
      const newKeyframes = [...s.weatherKeyframes, kf].sort((a, b) => a.time - b.time);
      return { weatherKeyframes: newKeyframes, useWeatherKeyframes: true };
    });
  },

  removeWeatherKeyframe: (id) =>
    set((s) => ({
      weatherKeyframes: s.weatherKeyframes.filter((k) => k.id !== id),
    })),

  updateWeatherKeyframe: (id, updates) =>
    set((s) => ({
      weatherKeyframes: s.weatherKeyframes.map((k) =>
        k.id === id ? { ...k, ...updates } : k
      ).sort((a, b) => a.time - b.time),
    })),

  moveWeatherKeyframe: (id, newTime) =>
    set((s) => ({
      weatherKeyframes: s.weatherKeyframes.map((k) =>
        k.id === id ? { ...k, time: clamp(newTime, 0, 24) } : k
      ).sort((a, b) => a.time - b.time),
    })),

  setUseWeatherKeyframes: (v) => set({ useWeatherKeyframes: v }),

  setWeatherTransitionDuration: (duration) =>
    set({ weatherTransitionDuration: clamp(duration, 0.5, 10) }),

  setWeatherLocked: (v) => set({ weatherLocked: v }),

  getInterpolatedWeather: (time) => {
    const state = get();
    const kfs = state.weatherKeyframes;
    if (kfs.length === 0) return null;

    const sorted = [...kfs].sort((a, b) => a.time - b.time);

    let before: WeatherKeyframe | null = null;
    let after: WeatherKeyframe | null = null;

    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].time <= time) {
        before = sorted[i];
      }
      if (sorted[i].time > time && after === null) {
        after = sorted[i];
      }
    }

    if (before === null && after === null) {
      return null;
    } else if (before !== null && after === null) {
      return before;
    } else if (before === null && after !== null) {
      return after;
    } else {
      const t = (time - before!.time) / (after!.time - before!.time);
      return lerpWeatherKeyframe(before!, after!, t);
    }
  },

  getWeatherCloudOffset: (time) => {
    const state = get();

    let weatherType: WeatherType = "clear";
    let rainIntensity: RainIntensity = "moderate";

    if (!state.weatherLocked) {
      if (state.useWeatherKeyframes && state.weatherKeyframes.length > 0) {
        const weatherKf = state.getInterpolatedWeather(time);
        if (weatherKf) {
          weatherType = weatherKf.weatherType;
          rainIntensity = weatherKf.rainIntensity;
        }
      } else if (state.useWeatherPreset) {
        const precip = getPrecipitationParams(time);
        weatherType = precip.weatherType;
        rainIntensity = precip.rainIntensity;
      }
    }

    let coverageOffset = 0;
    let windMultiplier = 1;

    if (weatherType === "rain") {
      if (rainIntensity === "storm") {
        coverageOffset = 0.45;
        windMultiplier = 1.5;
      } else if (rainIntensity === "heavy") {
        coverageOffset = 0.35;
        windMultiplier = 1.3;
      } else if (rainIntensity === "moderate") {
        coverageOffset = 0.25;
        windMultiplier = 1.2;
      } else {
        coverageOffset = 0.15;
        windMultiplier = 1.1;
      }
    } else if (weatherType === "snow") {
      coverageOffset = 0.15;
      windMultiplier = 0.8;
    }

    return { coverageOffset, windMultiplier };
  },
}));

export { PLAYBACK_SPEEDS, getDefaultWeatherParams, getWeatherTypeColor };
