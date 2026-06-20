import type { RenderParams, CameraState } from "@/types";

export const PLANET_RADIUS = 6371e3;
export const RAYLEIGH_SCALE_HEIGHT_DEFAULT = 8e3;
export const MIE_SCALE_HEIGHT_DEFAULT = 1.2e3;
export const CLOUD_BASE_DEFAULT = 2e3;
export const CLOUD_THICKNESS_DEFAULT = 4e3;

export const DEFAULT_RAYLEIGH: [number, number, number] = [5.8e-6, 13.5e-6, 33.1e-6];
export const DEFAULT_MIE = 2.1e-5;

export const MAX_ATMOSPHERE_STEPS = 64;
export const MAX_CLOUD_STEPS = 96;
export const LIGHT_MARCH_STEPS = 6;

export const DEFAULT_RENDER_PARAMS: RenderParams = {
  sunAzimuth: 135,
  sunElevation: 28,
  sunIntensity: 22.0,
  colorTempOverride: false,
  colorTemp: 6500,

  rayleighCoeff: DEFAULT_RAYLEIGH,
  mieCoeff: DEFAULT_MIE,
  mieG: 0.76,
  rayleighScaleHeight: RAYLEIGH_SCALE_HEIGHT_DEFAULT,
  mieScaleHeight: MIE_SCALE_HEIGHT_DEFAULT,

  coverage: 0.45,
  cloudBase: CLOUD_BASE_DEFAULT,
  cloudThickness: CLOUD_THICKNESS_DEFAULT,
  noiseFrequency: 1.0,
  detailStrength: 0.55,
  windSpeed: 0.6,
  windDirection: 60,

  atmosphereSteps: 32,
  cloudSteps: 64,
  resolutionScale: 1.0,

  visibility: 30000,
  cloudShadowStrength: 0.6,

  weatherType: "clear",
  rainIntensity: "moderate",
  particleDensityMultiplier: 1.0,
  windParticleInfluence: 1.0,
  snowAccumulation: 0.0,
  lightningEnabled: true,
};

export const DEFAULT_CAMERA: CameraState = {
  azimuth: 90,
  elevation: 8,
  fov: 55,
  distance: 1.0,
};

export const MAX_PARTICLES = 100000;
export const MAX_RIPPLES = 2000;
export const MAX_LIGHTNING_SEGMENTS = 256;

export const RAIN_CONFIG: Record<string, { density: number; fallSpeed: number; length: number }> = {
  light: { density: 0.15, fallSpeed: 8.0, length: 15.0 },
  moderate: { density: 0.4, fallSpeed: 12.0, length: 25.0 },
  heavy: { density: 0.7, fallSpeed: 16.0, length: 35.0 },
  storm: { density: 1.0, fallSpeed: 22.0, length: 50.0 },
};

export const PARAM_META: Record<
  string,
  { min: number; max: number; step: number; unit: string }
> = {
  sunAzimuth: { min: 0, max: 360, step: 1, unit: "°" },
  sunElevation: { min: -10, max: 90, step: 0.5, unit: "°" },
  sunIntensity: { min: 0, max: 60, step: 0.5, unit: "" },
  colorTemp: { min: 1500, max: 12000, step: 100, unit: "K" },
  mieCoeff: { min: 0, max: 8e-5, step: 0.5e-6, unit: "" },
  mieG: { min: -0.9, max: 0.99, step: 0.01, unit: "" },
  rayleighScaleHeight: { min: 1e3, max: 20e3, step: 100, unit: "m" },
  mieScaleHeight: { min: 0.2e3, max: 5e3, step: 50, unit: "m" },
  coverage: { min: 0, max: 1, step: 0.01, unit: "" },
  cloudBase: { min: 500, max: 6000, step: 50, unit: "m" },
  cloudThickness: { min: 500, max: 6000, step: 50, unit: "m" },
  noiseFrequency: { min: 0.2, max: 3.0, step: 0.02, unit: "" },
  detailStrength: { min: 0, max: 1.5, step: 0.01, unit: "" },
  windSpeed: { min: 0, max: 3, step: 0.05, unit: "" },
  windDirection: { min: 0, max: 360, step: 1, unit: "°" },
  atmosphereSteps: { min: 8, max: 64, step: 1, unit: "" },
  cloudSteps: { min: 16, max: 96, step: 2, unit: "" },
  resolutionScale: { min: 0.25, max: 1, step: 0.05, unit: "" },
  visibility: { min: 1000, max: 100000, step: 500, unit: "m" },
  cloudShadowStrength: { min: 0, max: 1, step: 0.01, unit: "" },
  particleDensityMultiplier: { min: 0.1, max: 3.0, step: 0.05, unit: "x" },
  windParticleInfluence: { min: 0, max: 2.0, step: 0.05, unit: "" },
  snowAccumulation: { min: 0, max: 1, step: 0.01, unit: "" },
};
