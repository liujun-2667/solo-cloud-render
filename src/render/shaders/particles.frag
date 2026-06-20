#version 300 es
precision highp float;

in float v_alpha;
in float v_speed;
in float v_dist;
flat in int v_type;

out vec4 outColor;

float sdHexagon(vec2 p, float r) {
  const vec3 k = vec3(-0.866025404, 0.5, 0.577350269);
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

void main() {
  if (v_alpha <= 0.01) discard;

  vec2 uv = gl_PointCoord * 2.0 - 1.0;

  if (v_type == 0) {
    float speedFactor = clamp(v_speed / 20.0, 0.3, 1.5);
    float lineWidth = 0.08 + (1.0 - speedFactor) * 0.1;
    float lineHalfWidth = lineWidth * 0.5;

    float verticalDist = abs(uv.x);
    float alongLine = uv.y;

    float lineMask = 1.0 - smoothstep(lineHalfWidth, lineHalfWidth + 0.02, verticalDist);
    float edgeFade = 1.0 - smoothstep(0.8, 1.0, abs(alongLine));
    lineMask *= edgeFade;

    if (lineMask <= 0.01) discard;

    float alpha = v_alpha * lineMask;
    float distFade = 1.0 - smoothstep(5000.0, 12000.0, v_dist);
    alpha *= distFade;

    vec3 rainColor = vec3(0.85, 0.9, 0.95);
    outColor = vec4(rainColor, alpha * 0.6);
  } else {
    float size = 0.8;
    float hexDist = sdHexagon(uv, size);

    float softEdge = 0.08;
    float hexMask = 1.0 - smoothstep(0.0, softEdge, hexDist);

    float innerGlow = smoothstep(size, size * 0.3, length(uv));
    hexMask = mix(hexMask, hexMask * (0.6 + innerGlow * 0.4), 0.5);

    if (hexMask <= 0.01) discard;

    float alpha = v_alpha * hexMask;
    float distFade = 1.0 - smoothstep(4000.0, 10000.0, v_dist);
    alpha *= distFade;

    vec3 snowColor = vec3(0.95, 0.97, 1.0);
    float brightness = 0.8 + innerGlow * 0.2;
    outColor = vec4(snowColor * brightness, alpha * 0.85);
  }
}
