#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;

uniform sampler2D u_tex;
uniform vec2 u_resolution;
uniform float u_vignette;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 color = texture(u_tex, uv).rgb;

  // Subtle cinematic vignette to focus the sky.
  vec2 v = uv - 0.5;
  float vig = 1.0 - dot(v, v) * u_vignette;
  color *= vig;

  outColor = vec4(color, 1.0);
}
