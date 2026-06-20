#version 300 es
#define VERT

layout(location = 0) in vec4 a_rippleData;

uniform mat4 u_viewProj;
uniform vec3 u_camRight;
uniform vec3 u_camUp;
uniform float u_time;

out float v_age;
out float v_maxAge;
out float v_dist;

void main() {
  vec3 pos = a_rippleData.xyz;
  float startTime = a_rippleData.w;

  float age = u_time - startTime;
  v_age = age;
  v_maxAge = 1.2;

  if (age < 0.0 || age > v_maxAge) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  vec4 clip = u_viewProj * vec4(pos, 1.0);
  gl_Position = clip;

  float progress = age / v_maxAge;
  float rippleSize = 5.0 + progress * 40.0;

  vec3 toCam = pos - (u_viewProj * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  v_dist = length(toCam);
  float perspectiveScale = max(1.0, 200.0 / max(v_dist, 1.0));

  gl_PointSize = rippleSize * perspectiveScale;
}
