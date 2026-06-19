import type { Preset } from "@/types";
import { DEFAULT_RENDER_PARAMS, DEFAULT_CAMERA } from "@/render/constants";

export const PRESETS: Preset[] = [
  {
    id: "clear-noon",
    name: "晴朗正午",
    description: "万里无云,正午阳光直射,天空澄澈湛蓝。",
    accent: "#4fc3f7",
    params: {
      sunAzimuth: 150,
      sunElevation: 70,
      sunIntensity: 26,
      coverage: 0.15,
      cloudBase: 2200,
      cloudThickness: 2600,
      mieG: 0.76,
      rayleighCoeff: [5.8e-6, 13.5e-6, 33.1e-6],
      noiseFrequency: 1.0,
      detailStrength: 0.55,
    },
    camera: { azimuth: 90, elevation: 12, fov: 55 },
  },
  {
    id: "golden-sunset",
    name: "金色日落",
    description: "夕阳低悬地平线,天空染成橙红,云层镀上金边。",
    accent: "#ff8a3d",
    params: {
      sunAzimuth: 280,
      sunElevation: 4,
      sunIntensity: 18,
      coverage: 0.5,
      cloudBase: 1800,
      cloudThickness: 3400,
      mieG: 0.82,
      rayleighCoeff: [7.5e-6, 16.0e-6, 38.0e-6],
      noiseFrequency: 1.05,
      detailStrength: 0.65,
      windSpeed: 0.5,
    },
    camera: { azimuth: 285, elevation: 4, fov: 60 },
  },
  {
    id: "overcast",
    name: "阴天多云",
    description: "云层密布覆盖天空,光线柔和漫射,灰白一片。",
    accent: "#9fb3d4",
    params: {
      sunAzimuth: 120,
      sunElevation: 40,
      sunIntensity: 16,
      coverage: 0.85,
      cloudBase: 1600,
      cloudThickness: 4200,
      mieG: 0.7,
      rayleighCoeff: [5.0e-6, 12.0e-6, 30.0e-6],
      noiseFrequency: 0.9,
      detailStrength: 0.45,
      windSpeed: 0.8,
    },
    camera: { azimuth: 110, elevation: 10, fov: 58 },
  },
  {
    id: "storm-approaching",
    name: "风暴前夕",
    description: "厚重低垂的乌云压顶,天色阴沉压抑,暴雨将至。",
    accent: "#5a6b8c",
    params: {
      sunAzimuth: 95,
      sunElevation: 22,
      sunIntensity: 9,
      coverage: 0.95,
      cloudBase: 1000,
      cloudThickness: 5500,
      mieG: 0.68,
      rayleighCoeff: [6.2e-6, 14.5e-6, 34.0e-6],
      noiseFrequency: 0.8,
      detailStrength: 0.5,
      windSpeed: 1.4,
    },
    camera: { azimuth: 100, elevation: 6, fov: 62 },
  },
  {
    id: "high-cirrus",
    name: "高空卷云",
    description: "高层稀薄卷云如丝,阳光穿透,天空通透高远。",
    accent: "#bfe9ff",
    params: {
      sunAzimuth: 200,
      sunElevation: 55,
      sunIntensity: 24,
      coverage: 0.28,
      cloudBase: 5200,
      cloudThickness: 1800,
      mieG: 0.78,
      rayleighCoeff: [5.5e-6, 13.0e-6, 32.0e-6],
      noiseFrequency: 1.6,
      detailStrength: 0.8,
      windSpeed: 1.0,
    },
    camera: { azimuth: 200, elevation: 22, fov: 50 },
  },
  {
    id: "starry-night",
    name: "星空夜幕",
    description: "太阳沉入地平线下,大气散射极弱,夜空繁星点点。",
    accent: "#7c8cff",
    params: {
      sunAzimuth: 310,
      sunElevation: -8,
      sunIntensity: 3,
      coverage: 0.12,
      cloudBase: 2800,
      cloudThickness: 2200,
      mieG: 0.74,
      rayleighCoeff: [3.0e-6, 7.0e-6, 18.0e-6],
      noiseFrequency: 1.1,
      detailStrength: 0.6,
      windSpeed: 0.4,
    },
    camera: { azimuth: 310, elevation: 2, fov: 64 },
  },
];

export const DEFAULT_PRESET_ID = "clear-noon";

export function presetToParams(preset: Preset): Preset["params"] & typeof DEFAULT_RENDER_PARAMS {
  return { ...DEFAULT_RENDER_PARAMS, ...preset.params };
}

export function presetToCamera(preset: Preset) {
  return { ...DEFAULT_CAMERA, ...preset.camera };
}

export function getPresetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
