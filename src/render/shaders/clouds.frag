#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
precision highp usampler3D;
out vec4 outColor;

uniform vec3 u_camPos;
uniform vec3 u_camForward;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform float u_tanHalfFov;
uniform float u_aspect;
uniform vec2 u_resolution;
uniform vec2 u_jitter;

uniform vec3 u_sunDir;
uniform vec3 u_sunColor;
uniform float u_sunIntensity;
uniform float u_mieG;

uniform float u_cloudBase;
uniform float u_cloudThickness;
uniform float u_coverage;
uniform float u_noiseFreq;
uniform float u_detailStrength;
uniform vec3 u_windOffset;
uniform float u_densityScale;
uniform float u_absorption;
uniform float u_ambientStrength;

uniform vec3 u_ambientColor;
uniform vec3 u_sunAttenuation;

uniform int u_cloudSteps;
uniform int u_lightSteps;
uniform float u_maxDistance;
uniform float u_lightStepSize;
uniform float u_time;

uniform sampler3D u_cloudNoise;

const float PI = 3.14159265359;
const float CLOUD_WORLD_SCALE = 1.0 / 8000.0;

float remap(float v, float a0, float a1, float b0, float b1) {
  return b0 + (b1 - b0) * clamp((v - a0) / max(a1 - a0, 1e-5), 0.0, 1.0);
}

float hgPhase(float cosT, float g) {
  float g2 = g * g;
  float denom = max(1.0 + g2 - 2.0 * g * cosT, 1e-5);
  return (1.0 / (4.0 * PI)) * ((1.0 - g2) / (pow(denom, 1.5) * (2.0 + g2)));
}

float dualLobeHG(float cosT) {
  float g = u_mieG;
  float forward = hgPhase(cosT, mix(g, 0.9, 0.5));
  float backward = hgPhase(cosT, -0.5);
  return mix(forward, backward, 0.35);
}

float heightGradient(float h) {
  // h in [0,1] within the slab. Smooth roll-off at the bottom and top.
  float g = sin(clamp(h, 0.0, 1.0) * PI);
  // Bias the peak toward the upper third so bottoms erode into wisps.
  float shaped = mix(g, smoothstep(0.0, 0.7, h) * smoothstep(1.0, 0.55, h), 0.5);
  return shaped;
}

float sampleDensity(vec3 p) {
  float h = (p.y - u_cloudBase) / u_cloudThickness;
  if (h < 0.0 || h > 1.0) return 0.0;
  float heightG = heightGradient(h);
  if (heightG <= 0.001) return 0.0;

  vec3 sp = p * CLOUD_WORLD_SCALE * u_noiseFreq + u_windOffset;
  vec4 noise = texture(u_cloudNoise, sp);
  float base = noise.r;
  vec3 worley = noise.gba;
  float wfbm = worley.x * 0.625 + worley.y * 0.25 + worley.z * 0.125;

  float cloud = remap(base, 1.0 - u_coverage, 1.0, 0.0, 1.0);
  cloud = remap(cloud, wfbm * u_detailStrength, 1.0, 0.0, 1.0);
  cloud *= heightG;
  return clamp(cloud * u_densityScale, 0.0, 1.0);
}

float lightMarch(vec3 p) {
  float densityAccum = 0.0;
  float stepSize = u_lightStepSize;
  for (int i = 0; i < 16; i++) {
    if (i >= u_lightSteps) break;
    vec3 sp = p + u_sunDir * (stepSize * (float(i) + 0.5));
    densityAccum += sampleDensity(sp) * stepSize;
  }
  return densityAccum;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution + u_jitter;
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 rd = normalize(u_camForward + u_camRight * (ndc.x * u_aspect * u_tanHalfFov) + u_camUp * (ndc.y * u_tanHalfFov));
  vec3 ro = u_camPos;

  // Slab intersection: horizontal layers at cloudBase and cloudBase+thickness.
  float bottom = u_cloudBase;
  float top = u_cloudBase + u_cloudThickness;
  float tBottom = (bottom - ro.y) / rd.y;
  float tTop = (top - ro.y) / rd.y;
  float tEnter = min(tBottom, tTop);
  float tExit = max(tBottom, tTop);
  if (rd.y > 0.0) {
    tEnter = max(tEnter, 0.0);
  } else if (rd.y < 0.0) {
    tEnter = max(tEnter, 0.0);
    tExit = min(tExit, tEnter + u_maxDistance);
  }
  if (tEnter >= tExit || tExit <= 0.0) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }
  tEnter = max(tEnter, 0.0);
  tExit = min(tExit, tEnter + u_maxDistance);
  if (tEnter >= tExit) {
    outColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  float stepSize = (tExit - tEnter) / float(u_cloudSteps);
  vec3 cloudColor = vec3(0.0);
  float transmittance = 1.0;
  float cosTheta = dot(rd, -u_sunDir);

  for (int i = 0; i < 96; i++) {
    if (i >= u_cloudSteps) break;
    float t = tEnter + stepSize * (float(i) + 0.5);
    vec3 p = ro + rd * t;
    float density = sampleDensity(p);
    if (density > 0.005) {
      float lightDepth = lightMarch(p);
      float lightT = exp(-lightDepth * u_absorption);

      // Beer-Powder: combine forward extinction with powder effect for darker cores.
      float beer = exp(-density * stepSize * u_absorption);
      float powder = 1.0 - exp(-density * stepSize * u_absorption * 2.0);
      float extinctionBlend = mix(beer, powder, 0.5);

      float phase = dualLobeHG(cosTheta);

      // Direct sun scattering (attenuated by atmosphere above the cloud).
      vec3 sunCol = u_sunColor * u_sunIntensity * u_sunAttenuation;
      vec3 directLight = sunCol * lightT * phase * extinctionBlend;

      // Multi-scattering approximation: extra isotropic bounces, energy halved each octave.
      float ms1 = exp(-lightDepth * u_absorption * 0.25);
      float ms2 = exp(-lightDepth * u_absorption * 0.125);
      vec3 multiScatter = sunCol * (ms1 * 0.5 + ms2 * 0.25) * 0.35;

      // Ambient (sky / ground bounce) warms the cloud base, stronger at sunset.
      vec3 ambient = u_ambientColor * u_ambientStrength * (0.6 + 0.4 * (1.0 - cosTheta * 0.5));

      vec3 luminance = (directLight + multiScatter + ambient) * density * stepSize;
      cloudColor += transmittance * luminance;
      transmittance *= beer;
      if (transmittance < 0.01) break;
    }
  }

  outColor = vec4(cloudColor, transmittance);
}
