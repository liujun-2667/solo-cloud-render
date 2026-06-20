#version 300 es
precision highp float;

in float v_age;
in float v_maxAge;
in float v_dist;

out vec4 outColor;

void main() {
  float progress = v_age / v_maxAge;
  if (progress <= 0.0 || progress >= 1.0) discard;

  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = length(uv);

  float ringWidth = 0.12;
  float ringCenter = 0.7;
  float ringDist = abs(dist - ringCenter);

  float ringMask = 1.0 - smoothstep(0.0, ringWidth, ringDist);
  float fadeOut = 1.0 - smoothstep(0.0, 1.0, progress);
  float fadeIn = smoothstep(0.0, 0.15, progress);

  float alpha = ringMask * fadeOut * fadeIn * 0.4;

  float distFade = 1.0 - smoothstep(3000.0, 10000.0, v_dist);
  alpha *= distFade;

  if (alpha <= 0.01) discard;

  vec3 rippleColor = vec3(0.7, 0.8, 0.9);
  outColor = vec4(rippleColor, alpha);
}
