#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
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
uniform float u_sunIntensity;
uniform vec3 u_sunColor;
uniform float u_sunAngularRadius;

uniform float u_planetRadius;
uniform float u_atmosphereRadius;

uniform vec3 u_rayleighCoeff;
uniform float u_mieCoeff;
uniform float u_rayleighScaleHeight;
uniform float u_mieScaleHeight;
uniform float u_mieG;

uniform int u_steps;
uniform int u_lightSteps;

uniform vec3 u_groundColor;
uniform float u_exposure;

uniform float u_visibility;
uniform vec3 u_fogColor;
uniform float u_cloudShadowStrength;

uniform float u_cloudBase;
uniform float u_cloudThickness;
uniform float u_coverage;
uniform float u_noiseFreq;
uniform float u_detailStrength;
uniform vec3 u_windOffset;
uniform float u_densityScale;

uniform sampler3D u_cloudNoise;

const float PI = 3.14159265359;
const float MAX_DIST = 600000.0;
const float CLOUD_WORLD_SCALE = 1.0 / 8000.0;

float rayleighDensity(float h) {
  return exp(-max(h, 0.0) / u_rayleighScaleHeight);
}
float mieDensity(float h) {
  return exp(-max(h, 0.0) / u_mieScaleHeight);
}

float rayleighPhase(float cosT) {
  return (3.0 / (16.0 * PI)) * (1.0 + cosT * cosT);
}

float miePhase(float cosT, float g) {
  float g2 = g * g;
  float denom = max(1.0 + g2 - 2.0 * g * cosT, 1e-5);
  return (3.0 / (8.0 * PI)) * ((1.0 - g2) * (1.0 + cosT * cosT)) / ((2.0 + g2) * pow(denom, 1.5));
}

float remap(float v, float a0, float a1, float b0, float b1) {
  return b0 + (b1 - b0) * clamp((v - a0) / max(a1 - a0, 1e-5), 0.0, 1.0);
}

float heightGradient(float h) {
  float g = sin(clamp(h, 0.0, 1.0) * PI);
  float shaped = mix(g, smoothstep(0.0, 0.7, h) * smoothstep(1.0, 0.55, h), 0.5);
  return shaped;
}

float sampleCloudDensity(vec3 p) {
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

float sampleCloudShadow(vec3 groundPos) {
  if (u_sunDir.y <= 0.0) return 1.0;

  float cloudTop = u_cloudBase + u_cloudThickness;
  float tToCloudTop = (cloudTop - groundPos.y) / u_sunDir.y;

  vec3 cloudTopPos = groundPos + u_sunDir * tToCloudTop;

  float totalDensity = 0.0;
  int samples = 4;
  float stepHeight = u_cloudThickness / float(samples);
  float stepDist = stepHeight / u_sunDir.y;

  for (int i = 0; i < 8; i++) {
    if (i >= samples) break;
    float t = -stepDist * (float(i) + 0.5);
    vec3 p = cloudTopPos + u_sunDir * t;
    float d = sampleCloudDensity(p);
    totalDensity += d * stepHeight;
  }

  float shadowFactor = exp(-totalDensity * 2.5);
  return mix(1.0, shadowFactor, u_cloudShadowStrength);
}

vec2 opticalDepth(vec3 ro, vec3 rd, float tMax, int steps) {
  float stepSize = tMax / float(steps);
  float rD = 0.0;
  float mD = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= steps) break;
    float t = stepSize * (float(i) + 0.5);
    vec3 p = ro + rd * t;
    float h = p.y;
    if (h < 0.0) { rD = 1e9; break; }
    rD += rayleighDensity(h) * stepSize;
    mD += mieDensity(h) * stepSize;
  }
  return vec2(rD, mD);
}

float fogFactor(float dist) {
  float fogDensity = 1.0 / max(u_visibility, 1000.0);
  return 1.0 - exp(-dist * fogDensity);
}

vec3 computeSky() {
  vec2 uv = gl_FragCoord.xy / u_resolution + u_jitter;
  vec2 ndc = uv * 2.0 - 1.0;
  vec3 rd = normalize(u_camForward + u_camRight * (ndc.x * u_aspect * u_tanHalfFov) + u_camUp * (ndc.y * u_tanHalfFov));
  vec3 ro = u_camPos;

  float atmTop = u_atmosphereRadius - u_planetRadius;

  float groundT = (rd.y < -1e-5) ? (-ro.y / rd.y) : MAX_DIST;
  float skyExitT = (rd.y > 1e-5) ? ((atmTop - ro.y) / rd.y) : MAX_DIST;
  float tFar = min(min(groundT, skyExitT), MAX_DIST);
  float tNear = 0.0;

  bool hitGround = (rd.y < -1e-5) && groundT < skyExitT && groundT < MAX_DIST;

  float stepSize = (tFar - tNear) / float(u_steps);
  vec3 totalRayleigh = vec3(0.0);
  vec3 totalMie = vec3(0.0);
  float viewR = 0.0;
  float viewM = 0.0;

  for (int i = 0; i < 64; i++) {
    if (i >= u_steps) break;
    float t = tNear + stepSize * (float(i) + 0.5);
    vec3 p = ro + rd * t;
    float h = p.y;
    if (h < 0.0) break;
    float rD = rayleighDensity(h) * stepSize;
    float mD = mieDensity(h) * stepSize;
    viewR += rD;
    viewM += mD;

    float lFar;
    if (u_sunDir.y > 1e-5) {
      lFar = (atmTop - p.y) / u_sunDir.y;
    } else if (u_sunDir.y < -1e-5) {
      lFar = max(0.0, -p.y / u_sunDir.y);
    } else {
      lFar = MAX_DIST;
    }
    if (lFar <= 0.0) continue;
    vec2 lm = opticalDepth(p, u_sunDir, lFar, u_lightSteps);
    float lightR = lm.x;
    float lightM = lm.y;

    vec3 tau = u_rayleighCoeff * (viewR + lightR) + u_mieCoeff * 1.1 * (viewM + lightM);
    vec3 attenuation = exp(-tau);
    totalRayleigh += rD * attenuation;
    totalMie += mD * attenuation;
  }

  float cosTheta = dot(rd, u_sunDir);
  float rPhase = rayleighPhase(cosTheta);
  float mPhase = miePhase(cosTheta, u_mieG);

  vec3 sunCol = u_sunColor * u_sunIntensity;
  vec3 color = (u_rayleighCoeff * rPhase * totalRayleigh + u_mieCoeff * mPhase * totalMie) * sunCol;

  float sunCos = dot(rd, u_sunDir);
  float disk = smoothstep(cos(u_sunAngularRadius * 1.6), cos(u_sunAngularRadius * 0.5), sunCos);
  float sunVisible = (u_sunDir.y > 0.0 && !hitGround) ? 1.0 : 0.0;
  color += sunCol * disk * 220.0 * sunVisible;

  float viewDist = tFar;

  if (hitGround) {
    vec3 gp = ro + rd * groundT;
    vec3 n = vec3(0.0, 1.0, 0.0);
    float ndl = max(dot(n, u_sunDir), 0.0);
    float gFar = (u_sunDir.y > 1e-5) ? ((atmTop - gp.y) / u_sunDir.y) : 0.0;
    vec2 gm = opticalDepth(gp, u_sunDir, max(gFar, 0.0), u_lightSteps);
    vec3 gTransmittance = exp(-(u_rayleighCoeff * gm.x + u_mieCoeff * 1.1 * gm.y));

    float cloudShadow = 1.0;
    if (u_sunDir.y > 0.0 && u_cloudShadowStrength > 0.001) {
      cloudShadow = sampleCloudShadow(gp);
    }

    vec3 skyAmbient = (u_rayleighCoeff * 0.5 + vec3(u_mieCoeff * 0.1)) * sunCol * 12.0;
    vec3 groundShade = u_groundColor * (ndl * gTransmittance * sunCol * 1.4 * cloudShadow + skyAmbient * gTransmittance * 0.3 + 0.015);
    color = groundShade;
    viewDist = groundT;
  }

  float fog = fogFactor(viewDist);
  color = mix(color, u_fogColor * sunCol * 0.35, fog * 0.7);

  return color;
}

void main() {
  vec3 sky = computeSky();
  sky *= u_exposure;
  outColor = vec4(sky, 1.0);
}
