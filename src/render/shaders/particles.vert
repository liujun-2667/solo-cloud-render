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

void main() {
  v_type = u_particleType;
  float id = a_seed.w;

  float r1 = hash(id * 0.13 + 0.1);
  float r2 = hash(id * 0.27 + 0.2);
  float r3 = hash(id * 0.41 + 0.3);
  float r4 = hash(id * 0.71 + 0.4);
  float r5 = hash(id * 1.31 + 0.5);
  float r6 = hash(id * 2.11 + 0.6);
  float r7 = hash(id * 3.71 + 0.7);
  float r8 = hash(id * 5.31 + 0.8);

  // 生成位置：围绕相机 xz，高度在 [groundY+50, cloudBase] 全范围分布
  float angle = r1 * 6.2831853;
  float radius = sqrt(r2) * u_spawnAreaRadius;
  float startX = u_camPos.x + cos(angle) * radius;
  float startZ = u_camPos.z + sin(angle) * radius;
  float topY = u_cloudBase;
  float bottomY = u_groundY + 50.0;
  float startY = mix(bottomY, topY, r3);

  float effectiveFallSpeed = u_fallSpeed * (0.85 + r5 * 0.3);
  float windFactor = u_windInfluence * (0.7 + r6 * 0.6);

  // 粒子完整下落时间 = 下落距离 / 速度
  float fallDist = max(startY - u_groundY, 1.0);
  float lifeTime = fallDist / max(effectiveFallSpeed, 1.0);

  // 随机相位让粒子均匀分布在生命周期各阶段
  float phase = r7;
  float progress = mod(u_time / lifeTime + phase, 1.0);
  float elapsed = progress * lifeTime;

  vec3 pos;
  float alpha = 1.0;

  if (u_particleType == 0) {
    // 雨滴：快速直线下落
    pos.x = startX + u_windX * windFactor * elapsed;
    pos.z = startZ + u_windZ * windFactor * elapsed;
    pos.y = startY - effectiveFallSpeed * elapsed;

    alpha = 1.0 - smoothstep(0.8, 1.0, progress);
    if (pos.y <= u_groundY) {
      pos.y = u_groundY;
      alpha = 0.0;
    }
    v_speed = effectiveFallSpeed;
  } else {
    // 雪花：慢速下落 + 正弦摆动
    float snowFallSpeed = effectiveFallSpeed * 0.4;
    float snowWind = windFactor * 3.0;
    float snowLife = fallDist / max(snowFallSpeed, 1.0);
    progress = mod(u_time / snowLife + phase, 1.0);
    elapsed = progress * snowLife;

    float swayPhase = r4 * PI * 2.0;
    float swayFreq = 1.2 + r8 * 2.0;
    float swayAmp = 1.8 + r5 * 1.5;
    float swayX = sin(u_time * swayFreq + swayPhase) * swayAmp;
    float swayZ = cos(u_time * swayFreq * 0.7 + swayPhase * 1.3) * swayAmp * 0.8;

    pos.x = startX + u_windX * snowWind * elapsed + swayX;
    pos.z = startZ + u_windZ * snowWind * elapsed + swayZ;
    pos.y = startY - snowFallSpeed * elapsed;

    alpha = 1.0 - smoothstep(0.85, 1.0, progress);
    if (pos.y <= u_groundY) {
      pos.y = u_groundY;
      alpha = 0.0;
    }
    v_speed = snowFallSpeed;
  }

  vec3 toCam = pos - u_camPos;
  v_dist = length(toCam);
  float distFade = 1.0 - smoothstep(u_spawnAreaRadius * 0.8, u_spawnAreaRadius * 1.2, v_dist);
  alpha *= distFade;
  v_alpha = alpha;

  vec4 clip = u_viewProj * vec4(pos, 1.0);
  gl_Position = clip;

  if (u_particleType == 0) {
    float speedFactor = clamp(effectiveFallSpeed / 200.0, 0.4, 1.5);
    float perspectiveScale = max(3.0, 600.0 / max(v_dist, 1.0));
    gl_PointSize = u_particleLength * speedFactor * perspectiveScale * 0.5;
    gl_PointSize = clamp(gl_PointSize, 2.0, 64.0);
  } else {
    float size = 3.0 + r8 * 4.0;
    float perspectiveScale = max(2.0, 400.0 / max(v_dist, 1.0));
    gl_PointSize = size * perspectiveScale * 0.3;
    gl_PointSize = clamp(gl_PointSize, 2.0, 32.0);
  }
}
