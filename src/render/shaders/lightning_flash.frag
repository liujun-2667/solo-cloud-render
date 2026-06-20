#version 300 es
precision highp float;

uniform sampler2D u_sceneTex;
uniform vec2 u_resolution;
uniform float u_flashIntensity;

in vec2 v_uv;
out vec4 outColor;

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec3 scene = texture(u_sceneTex, uv).rgb;

  vec3 flashColor = vec3(1.0, 0.98, 0.95);
  vec3 result = mix(scene, flashColor, u_flashIntensity * 0.7);
  result += flashColor * u_flashIntensity * 0.3;

  outColor = vec4(result, 1.0);
}
