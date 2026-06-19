// Shared 3D noise library (GLSL ES 3.00)
// Used by the GPU noise-bake pass and the volumetric cloud shader.

uvec3 hash33(uvec3 x) {
  x = ((x >> 16u) ^ x) * 0x45d9f3bu;
  x = ((x >> 16u) ^ x) * 0x45d9f3bu;
  x = (x >> 16u) ^ x;
  return x;
}

vec3 hash33f(vec3 p) {
  uvec3 q = uvec3(
    floatBitsToUint(p.x),
    floatBitsToUint(p.y),
    floatBitsToUint(p.z)
  );
  uvec3 h = hash33(q);
  return vec3(h & 0xFFFFu) / float(0xFFFFu);
}

vec3 hash33i(ivec3 p) {
  uvec3 q = uvec3(p);
  uvec3 h = hash33(q);
  return (vec3(h) / float(0xFFFFFFFFu)) * 2.0 - 1.0;
}

float fade(float t) {
  return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
}

float grad3(ivec3 i, vec3 f) {
  vec3 g = hash33i(i);
  return dot(g, f);
}

float perlin3(vec3 p) {
  ivec3 i = ivec3(floor(p));
  vec3 f = fract(p);
  vec3 u = vec3(fade(f.x), fade(f.y), fade(f.z));
  float n000 = grad3(i + ivec3(0, 0, 0), f - vec3(0.0, 0.0, 0.0));
  float n100 = grad3(i + ivec3(1, 0, 0), f - vec3(1.0, 0.0, 0.0));
  float n010 = grad3(i + ivec3(0, 1, 0), f - vec3(0.0, 1.0, 0.0));
  float n110 = grad3(i + ivec3(1, 1, 0), f - vec3(1.0, 1.0, 0.0));
  float n001 = grad3(i + ivec3(0, 0, 1), f - vec3(0.0, 0.0, 1.0));
  float n101 = grad3(i + ivec3(1, 0, 1), f - vec3(1.0, 0.0, 1.0));
  float n011 = grad3(i + ivec3(0, 1, 1), f - vec3(0.0, 1.0, 1.0));
  float n111 = grad3(i + ivec3(1, 1, 1), f - vec3(1.0, 1.0, 1.0));
  float nx00 = mix(n000, n100, u.x);
  float nx10 = mix(n010, n110, u.x);
  float nx01 = mix(n001, n101, u.x);
  float nx11 = mix(n011, n111, u.x);
  float nxy0 = mix(nx00, nx10, u.y);
  float nxy1 = mix(nx01, nx11, u.y);
  return mix(nxy0, nxy1, u.z) * 0.5 + 0.5;
}

float worley3(vec3 p, float freq) {
  vec3 st = p * freq;
  ivec3 ist = ivec3(floor(st));
  vec3 fst = fract(st);
  float minDist = 8.0;
  for (int z = -1; z <= 1; z++) {
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        ivec3 offset = ivec3(x, y, z);
        vec3 cellPoint = hash33i(ist + offset) * 0.5 + 0.5;
        vec3 diff = vec3(offset) + cellPoint - fst;
        float d = dot(diff, diff);
        minDist = min(minDist, d);
      }
    }
  }
  return sqrt(minDist);
}

float fbmWorley(vec3 p, int octaves, float baseFreq, float lacunarity) {
  float total = 0.0;
  float amp = 1.0;
  float freq = baseFreq;
  float maxAmp = 0.0;
  for (int i = 0; i < 6; i++) {
    if (i >= octaves) break;
    float w = worley3(p, freq);
    total += w * amp;
    maxAmp += amp;
    amp *= 0.5;
    freq *= lacunarity;
  }
  return total / maxAmp;
}
