#version 300 es
precision highp float;

in float v_width;
in float v_brightness;
in vec3 v_worldPos;
in float v_dist;

out vec4 outColor;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = length(uv);

  // 三层发光渐变：核心纯白 → 内层淡紫白 → 外层深蓝紫
  float core = 1.0 - smoothstep(0.0, 0.08, dist);
  float inner = 1.0 - smoothstep(0.08, 0.35, dist);
  float mid = 1.0 - smoothstep(0.35, 0.7, dist);
  float outer = 1.0 - smoothstep(0.7, 1.0, dist);

  vec3 coreColor = vec3(1.0, 1.0, 1.0);
  vec3 innerColor = vec3(0.95, 0.9, 1.0);
  vec3 midColor = vec3(0.7, 0.45, 1.0);
  vec3 outerColor = vec3(0.35, 0.15, 0.8);

  // 距离雾衰减
  float distFade = 1.0 - smoothstep(8000.0, 20000.0, v_dist);

  vec3 color = coreColor * core * 3.0 +
               innerColor * inner * 1.5 +
               midColor * mid * 0.9 +
               outerColor * outer * 0.5;

  float alpha = (core * 1.0 + inner * 0.7 + mid * 0.4 + outer * 0.15) * v_brightness * distFade;

  outColor = vec4(color * v_brightness, clamp(alpha, 0.0, 1.0));
}
