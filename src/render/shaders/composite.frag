#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;

uniform sampler2D u_cloudTex;
uniform sampler2D u_atmosphereTex;
uniform sampler2D u_historyTex;

uniform vec2 u_resolution;
uniform vec2 u_jitter;
uniform float u_blendFactor;
uniform float u_exposure;
uniform float u_starIntensity;

uniform vec3 u_camForward;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform float u_tanHalfFov;
uniform float u_aspect;

uniform float u_time;

const float PI = 3.14159265359;

vec3 acesTonemap(vec3 x) {
  const float a = 2.51;
  const float b = 0.03;
  const float c = 2.43;
  const float d = 0.59;
  const float e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

vec3 hash33f(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yzx + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// Stable 3D-lattice star field: stars live on a spherical lattice around the
// view direction so they do not swim across the sky when the camera moves.
float starField(vec3 dir, float scale, float threshold, float twinkle) {
  vec3 p = dir * scale;
  vec3 cell = floor(p);
  vec3 f = fract(p);
  float star = 0.0;
  for (int z = 0; z <= 1; z++) {
    for (int y = 0; y <= 1; y++) {
      for (int x = 0; x <= 1; x++) {
        vec3 offset = vec3(float(x), float(y), float(z));
        vec3 rnd = hash33f(cell + offset);
        if (rnd.x > threshold) {
          vec3 starPos = offset + rnd;
          float d = length(f - starPos);
          float bright = pow(1.0 - rnd.x, 8.0) * 3.0;
          float tw = 0.7 + 0.3 * sin(u_time * (1.0 + rnd.y * 3.0) + rnd.z * 6.2831) * twinkle;
          star += smoothstep(0.06, 0.0, d) * bright * tw;
        }
      }
    }
  }
  return star;
}

vec3 viewRay(vec2 uv) {
  vec2 ndc = uv * 2.0 - 1.0;
  return normalize(u_camForward + u_camRight * (ndc.x * u_aspect * u_tanHalfFov) + u_camUp * (ndc.y * u_tanHalfFov));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;

  vec3 sky = texture(u_atmosphereTex, uv).rgb;
  vec4 cloud = texture(u_cloudTex, uv);

  // Front-to-back composite: cloud.rgb is accumulated luminance, cloud.a is transmittance.
  vec3 color = cloud.rgb + sky * cloud.a;

  // Stars (visible when the sky is dark, scaled by u_starIntensity).
  if (u_starIntensity > 0.001) {
    vec3 rd = viewRay(uv);
    float stars = starField(rd, 220.0, 0.965, 1.0) * 0.6;
    stars += starField(rd, 90.0, 0.985, 1.0);
    vec3 starColor = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 0.85, 0.7), fract(rd.x * 12.3));
    color += starColor * stars * u_starIntensity * cloud.a;
  }

  // Tone map the current frame to LDR before temporal accumulation.
  color *= u_exposure;
  color = acesTonemap(color);
  color = pow(color, vec3(1.0 / 2.2));

  // Temporal accumulation in LDR space.
  vec2 historyUv = clamp(uv + u_jitter, vec2(0.0), vec2(1.0));
  vec3 history = texture(u_historyTex, historyUv).rgb;
  color = mix(history, color, u_blendFactor);

  outColor = vec4(color, 1.0);
}
