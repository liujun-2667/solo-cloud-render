#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
out vec4 outColor;

uniform int u_texSize;
uniform int u_slice;
uniform int u_seed;

uniform float u_baseFreq;
uniform int u_octaves;
uniform float u_detailScale;

void main() {
  vec2 uv = gl_FragCoord.xy / float(u_texSize);
  vec3 p = vec3(uv, (float(u_slice) + 0.5) / float(u_texSize));

  // Base cloud shape: Perlin-Worley hybrid (low frequency, billowy blobs).
  float perlin = perlin3(p * u_baseFreq * 2.0 + float(u_seed));
  float worleyBase = worley3(p * u_baseFreq, u_baseFreq);
  worleyBase = clamp(worleyBase / 1.2, 0.0, 1.0);
  float perlinWorley = mix(perlin, 1.0 - worleyBase, 0.6);
  perlinWorley = clamp(perlinWorley, 0.0, 1.0);

  // Detail channels: Worley at three frequencies (high frequency erosion).
  float w1 = clamp(worley3(p * u_baseFreq, u_baseFreq * 2.0) / 1.2, 0.0, 1.0);
  float w2 = clamp(worley3(p * u_baseFreq, u_baseFreq * 4.0) / 1.2, 0.0, 1.0);
  float w3 = clamp(worley3(p * u_baseFreq, u_baseFreq * 8.0) / 1.2, 0.0, 1.0);
  vec3 worleyDetail = 1.0 - vec3(w1, w2, w3);

  outColor = vec4(perlinWorley, worleyDetail);
}
