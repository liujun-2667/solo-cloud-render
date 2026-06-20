#version 300 es
#define VERT

layout(location = 0) in vec4 a_seed;
layout(location = 1) in vec2 a_life;

uniform mat4 u_viewProj;
uniform vec3 u_camPos;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform float u_time;
uniform float u_dt;
uniform float u_coverage;
uniform float u_cloudBase;
uniform float u_cloudThickness;
uniform float u_windX;
uniform float u_windZ;
uniform float u_windInfluence;
uniform int u_particleType;
uniform float u_fallSpeed;
uniform float u_particleLength;
uniform float u_spawnRate;
uniform float u_spawnAreaRadius;
uniform float u_groundY;

out float v_alpha;
out float v_speed;
out float v_dist;
flat out int v_type;

const float PI = 3.14159265359;

float hash(float n) {
  return fract(sin(n) * 43758.5453123);
}

vec3 hash3(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
            dot(p, vec3(269.5, 183.3, 246.1)),
            dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453123);
}

void main() {
  v_type = u_particleType;
  float id = a_seed.w;
  vec3 seed = a_seed.xyz;

  float spawnInterval = 1.0 / max(0.001, u_spawnRate);
  float particleTime = mod(u_time + id * spawnInterval, spawnInterval * 10000.0);
  float lifeT = a_life.x;
  float maxLife = a_life.y;

  vec3 spawnOffset = hash3(vec3(id * 0.13, id * 0.27, id * 0.41)) - 0.5;
  spawnOffset *= 2.0;

  float startX = spawnOffset.x * u_spawnAreaRadius;
  float startZ = spawnOffset.z * u_spawnAreaRadius;
  float startY = u_cloudBase + hash(id * 0.7) * u_cloudThickness * 0.3;

  float effectiveFallSpeed = u_fallSpeed * (0.8 + hash(id * 1.3) * 0.4);
  float windFactor = u_windInfluence * (0.7 + hash(id * 2.1) * 0.6);

  vec3 pos;
  float alpha = 1.0;

  if (u_particleType == 0) {
    float t = particleTime;
    pos.x = startX + u_windX * windFactor * t;
    pos.z = startZ + u_windZ * windFactor * t;
    pos.y = startY - effectiveFallSpeed * t;

    float totalFall = startY - u_groundY;
    float fallT = clamp(t * effectiveFallSpeed / max(totalFall, 1.0), 0.0, 1.0);
    alpha = 1.0 - smoothstep(0.85, 1.0, fallT);

    if (pos.y <= u_groundY) {
      pos.y = u_groundY;
      alpha = 0.0;
    }

    v_speed = effectiveFallSpeed;
  } else {
    float t = particleTime;
    effectiveFallSpeed *= 0.25;
    windFactor *= 3.0;

    float phase = hash(id * 3.7) * PI * 2.0;
    float freq = 1.5 + hash(id * 5.3) * 2.5;
    float swayX = sin(t * freq + phase) * 1.5;
    float swayZ = cos(t * freq * 0.7 + phase * 1.3) * 1.2;

    pos.x = startX + u_windX * windFactor * t + swayX;
    pos.z = startZ + u_windZ * windFactor * t + swayZ;
    pos.y = startY - effectiveFallSpeed * t;

    float totalFall = startY - u_groundY;
    float fallT = clamp(t * effectiveFallSpeed / max(totalFall, 1.0), 0.0, 1.0);
    alpha = 1.0 - smoothstep(0.9, 1.0, fallT);

    if (pos.y <= u_groundY) {
      pos.y = u_groundY;
      alpha = 0.0;
    }

    v_speed = effectiveFallSpeed;
  }

  vec3 toCam = pos - u_camPos;
  v_dist = length(toCam);
  float distFade = 1.0 - smoothstep(8000.0, 15000.0, v_dist);
  alpha *= distFade;
  v_alpha = alpha;

  vec4 clip = u_viewProj * vec4(pos, 1.0);
  gl_Position = clip;

  if (u_particleType == 0) {
    float speedFactor = clamp(effectiveFallSpeed / 25.0, 0.3, 1.5);
    float perspectiveScale = max(2.0, 80.0 / max(v_dist, 1.0));
    gl_PointSize = u_particleLength * speedFactor * perspectiveScale;
  } else {
    float size = 2.0 + hash(id * 7.9) * 4.0;
    float perspectiveScale = max(1.0, 60.0 / max(v_dist, 1.0));
    gl_PointSize = size * perspectiveScale;
  }
}
