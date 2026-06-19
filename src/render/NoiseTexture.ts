import {
  createProgram,
  createFullscreenVAO,
  drawFullscreen,
  compileShader,
} from "./GLContext";
import noiseGLSL from "./shaders/noise.glsl?raw";
import noiseGenFrag from "./shaders/noise_gen.frag?raw";

export interface NoiseGenOptions {
  size: number;
  seed: number;
  baseFreq: number;
  octaves: number;
  detailScale: number;
}

const NOISE_GEN_UNIFORMS = ["u_texSize", "u_slice", "u_seed", "u_baseFreq", "u_octaves", "u_detailScale"];

// The noise library has no #version/precision directives (it's shared GLSL),
// while the fragment shader starts with `#version 300 es` + precision lines.
// GLSL requires the version directive first, and precision must be declared
// before any float/int/sampler types are used. So we strip the version and
// precision lines from the fragment shader and re-prepend them ahead of the
// library.
const NOISE_FRAG_SOURCE = (() => {
  const header = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
`;
  const fragBody = noiseGenFrag
    .split(/\r?\n/)
    .filter((line) => !/^#version\s/.test(line) && !/^precision\s/.test(line))
    .join("\n");
  return header + noiseGLSL + "\n" + fragBody;
})();

const FULLSCREEN_VS = `#version 300 es
layout(location = 0) in vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export class NoiseTextureGenerator {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private framebuffer: WebGLFramebuffer;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, NOISE_FRAG_SOURCE);
    const vs = compileShader(gl, gl.VERTEX_SHADER, FULLSCREEN_VS);
    const program = gl.createProgram();
    if (!program) throw new Error("Failed to allocate noise program.");
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(`Noise program link error: ${gl.getProgramInfoLog(program)}`);
    }
    this.program = program;
    const { vao } = createFullscreenVAO(gl);
    this.vao = vao;
    this.framebuffer = gl.createFramebuffer()!;
  }

  generate(opts: NoiseGenOptions): WebGLTexture {
    const gl = this.gl;
    const { size, seed, baseFreq, octaves, detailScale } = opts;

    const texture = gl.createTexture();
    if (!texture) throw new Error("Failed to allocate 3D noise texture.");
    gl.bindTexture(gl.TEXTURE_3D, texture);
    gl.texImage3D(
      gl.TEXTURE_3D,
      0,
      gl.RGBA8,
      size,
      size,
      size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.REPEAT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
    gl.viewport(0, 0, size, size);
    gl.useProgram(this.program);

    const uniforms: Record<string, WebGLUniformLocation | null> = {};
    for (const name of NOISE_GEN_UNIFORMS) {
      uniforms[name] = gl.getUniformLocation(this.program, name);
    }
    gl.uniform1i(uniforms.u_texSize, size);
    gl.uniform1i(uniforms.u_seed, seed);
    gl.uniform1f(uniforms.u_baseFreq, baseFreq);
    gl.uniform1i(uniforms.u_octaves, octaves);
    gl.uniform1f(uniforms.u_detailScale, detailScale);

    gl.bindVertexArray(this.vao);
    for (let slice = 0; slice < size; slice++) {
      gl.framebufferTextureLayer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, texture, 0, slice);
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error(`Noise framebuffer incomplete at slice ${slice}: 0x${status.toString(16)}`);
      }
      gl.uniform1i(uniforms.u_slice, slice);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_3D, null);

    return texture;
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.program);
    gl.deleteFramebuffer(this.framebuffer);
  }
}
