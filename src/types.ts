export type Vec3 = [number, number, number];

export interface RenderParams {
  sunAzimuth: number;
  sunElevation: number;
  sunIntensity: number;
  colorTempOverride: boolean;
  colorTemp: number;

  rayleighCoeff: Vec3;
  mieCoeff: number;
  mieG: number;
  rayleighScaleHeight: number;
  mieScaleHeight: number;

  coverage: number;
  cloudBase: number;
  cloudThickness: number;
  noiseFrequency: number;
  detailStrength: number;
  windSpeed: number;
  windDirection: number;

  atmosphereSteps: number;
  cloudSteps: number;
  resolutionScale: number;
}

export interface CameraState {
  azimuth: number;
  elevation: number;
  fov: number;
  distance: number;
}

export interface Preset {
  id: string;
  name: string;
  description: string;
  accent: string;
  params: Partial<RenderParams>;
  camera: Partial<CameraState>;
}

export interface SceneConfig {
  params: RenderParams;
  camera: CameraState;
  presetId: string;
}

export interface RenderStats {
  fps: number;
  frameMs: number;
  cloudMs: number;
  atmosphereMs: number;
  compositeMs: number;
  resolution: [number, number];
}
