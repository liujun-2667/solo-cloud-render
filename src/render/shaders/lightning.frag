#version 300 es
precision highp float;

in float v_width;
in float v_brightness;
in vec3 v_worldPos;

out vec4 outColor;

void main() {
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float dist = length(uv);

  float core = 1.0 - smoothstep(0.0, 0.15, dist);
  float innerGlow = 1.0 - smoothstep(0.15, 0.5, dist);
  float outerGlow = 1.0 - smoothstep(0.5, 1.0, dist);

  vec3 coreColor = vec3(1.0, 1.0, 1.0);
  vec3 innerColor = vec3(0.9, 0.85, 1.0);
  vec3 outerColor = vec3(0.5, 0.3, 0.9);

  vec3 color = coreColor * core * 2.0 +
               innerColor * innerGlow * 0.8 +
               outerColor * outerGlow * 0.4;

  float alpha = (core * 0.9 + innerGlow * 0.5 + outerGlow * 0.2) * v_brightness;

  outColor = vec4(color * v_brightness, clamp(alpha, 0.0, 1.0));
}
