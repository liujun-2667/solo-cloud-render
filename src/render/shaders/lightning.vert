#version 300 es
#define VERT

layout(location = 0) in vec3 a_pos;
layout(location = 1) in float a_width;
layout(location = 2) in float a_brightness;

uniform mat4 u_viewProj;
uniform vec3 u_camPos;

out float v_width;
out float v_brightness;
out vec3 v_worldPos;
out float v_dist;

void main() {
  v_worldPos = a_pos;
  v_width = a_width;
  v_brightness = a_brightness;

  vec4 clip = u_viewProj * vec4(a_pos, 1.0);
  gl_Position = clip;

  float dist = length(a_pos - u_camPos);
  v_dist = dist;
  float perspectiveScale = max(2.0, 2500.0 / max(dist, 1.0));
  float worldWidth = a_width * 6.0;
  gl_PointSize = worldWidth * perspectiveScale;
  gl_PointSize = clamp(gl_PointSize, 8.0, 256.0);
}
