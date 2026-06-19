import type { RenderParams } from "@/types";
import { OrbitCamera } from "./Camera";
import { PLANET_RADIUS } from "./constants";
import { sunColorByElevation, colorTempToRGB, lerpColor } from "@/utils/colorTemp";
import { sunDirection, degToRad } from "@/utils/math";
import type { Vec3 } from "@/types";

export interface FrameContext {
  camPos: Vec3;
  forward: Vec3;
  right: Vec3;
  up: Vec3;
  tanHalfFov: number;
  aspect: number;
  resolution: [number, number];
  cloudResolution: [number, number];

  sunDir: Vec3;
  sunIntensity: number;
  sunColor: Vec3;
  sunAngularRadius: number;

  planetRadius: number;
  atmosphereRadius: number;

  rayleighCoeff: Vec3;
  mieCoeff: number;
  rayleighScaleHeight: number;
  mieScaleHeight: number;
  mieG: number;
  atmosphereSteps: number;
  atmosphereLightSteps: number;
  groundColor: Vec3;
  exposure: number;
  starIntensity: number;

  cloudBase: number;
  cloudThickness: number;
  coverage: number;
  noiseFreq: number;
  detailStrength: number;
  densityScale: number;
  absorption: number;
  ambientStrength: number;
  windOffset: Vec3;
  ambientColor: Vec3;
  sunAttenuation: Vec3;
  cloudSteps: number;
  cloudLightSteps: number;
  maxDistance: number;
  lightStepSize: number;
  time: number;

  visibility: number;
  cloudShadowStrength: number;
  fogColor: Vec3;
}

export function buildFrameContext(
  params: RenderParams,
  camera: OrbitCamera,
  width: number,
  height: number,
  cloudWidth: number,
  cloudHeight: number,
  time: number,
): FrameContext {
  const basis = camera.basis();
  const aspect = width / height;
  const cloudAspect = cloudWidth / cloudHeight;

  const sunDir = sunDirection(params.sunAzimuth, params.sunElevation);
  const elevation = params.sunElevation;

  const elevationColor = sunColorByElevation(elevation);
  let sunColor: Vec3;
  if (params.colorTempOverride) {
    sunColor = colorTempToRGB(params.colorTemp);
  } else {
    sunColor = elevationColor.color;
  }
  // Boost warm channels a touch so sunsets read richly.
  sunColor = [
    clamp01(sunColor[0]),
    clamp01(sunColor[1]),
    clamp01(sunColor[2]),
  ];

  const starIntensity =
    elevation < 0 ? Math.min(1, (-elevation) / 8) * (1 - params.coverage * 0.6) : 0;

  // Atmosphere transmittance factor reaching the cloud layer (rough approximation
  // based on sun elevation — lower sun means more atmosphere to traverse).
  const atmosTrans = Math.max(0.05, Math.sin(Math.max(degToRad(elevation), degToRad(-8))));
  const sunAttenuation: Vec3 = [
    Math.pow(atmosTrans, 0.6),
    Math.pow(atmosTrans, 0.5),
    Math.pow(atmosTrans, 0.4),
  ];

  // Ambient sky color for cloud base lighting: cool blue day, warm at sunset.
  const dayAmbient: Vec3 = [0.35, 0.55, 0.9];
  const sunsetAmbient: Vec3 = [0.9, 0.45, 0.25];
  const nightAmbient: Vec3 = [0.05, 0.07, 0.12];
  let ambientColor: Vec3;
  if (elevation >= 5) {
    ambientColor = lerpColor(sunsetAmbient, dayAmbient, Math.min(1, (elevation - 5) / 30));
  } else if (elevation >= -3) {
    ambientColor = lerpColor(nightAmbient, sunsetAmbient, Math.min(1, (elevation + 3) / 8));
  } else {
    ambientColor = nightAmbient;
  }

  // Wind offset in texture space (scrolls the 3D noise over time).
  const windRad = degToRad(params.windDirection);
  const windScale = params.windSpeed * 0.006;
  const windOffset: Vec3 = [
    Math.cos(windRad) * windScale * time,
    windScale * 0.15 * time,
    Math.sin(windRad) * windScale * time,
  ];

  const atmosphereLightSteps = Math.max(4, Math.round(params.atmosphereSteps * 0.35));
  const cloudLightSteps = 6;
  const maxDistance = 150000.0;
  const lightStepSize = params.cloudThickness / cloudLightSteps * 0.8 + 1200.0;

  const fogColor: Vec3 = [
    0.75 + sunColor[0] * 0.1,
    0.78 + sunColor[1] * 0.1,
    0.82 + sunColor[2] * 0.05,
  ];

  return {
    camPos: camera.position,
    forward: basis.forward,
    right: basis.right,
    up: basis.up,
    tanHalfFov: camera.tanHalfFov(),
    aspect,
    resolution: [width, height],
    cloudResolution: [cloudWidth, cloudHeight],

    sunDir,
    sunIntensity: params.sunIntensity,
    sunColor,
    sunAngularRadius: 0.02,

    planetRadius: PLANET_RADIUS,
    atmosphereRadius: PLANET_RADIUS + 80000,

    rayleighCoeff: params.rayleighCoeff,
    mieCoeff: params.mieCoeff,
    rayleighScaleHeight: params.rayleighScaleHeight,
    mieScaleHeight: params.mieScaleHeight,
    mieG: params.mieG,
    atmosphereSteps: params.atmosphereSteps,
    atmosphereLightSteps,
    groundColor: [0.18, 0.16, 0.13],
    exposure: 1.0,
    starIntensity,

    cloudBase: params.cloudBase,
    cloudThickness: params.cloudThickness,
    coverage: params.coverage,
    noiseFreq: params.noiseFrequency,
    detailStrength: params.detailStrength,
    densityScale: 1.0,
    absorption: 0.9,
    ambientStrength: 0.8,
    windOffset,
    ambientColor,
    sunAttenuation,
    cloudSteps: params.cloudSteps,
    cloudLightSteps,
    maxDistance,
    lightStepSize,
    time: time * 0.001,

    visibility: params.visibility,
    cloudShadowStrength: params.cloudShadowStrength,
    fogColor,
  };
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
