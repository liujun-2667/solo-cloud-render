export type UniformSetter = (loc: WebGLUniformLocation | null, value: number | number[] | Float32Array | Int32Array) => void;

export interface ProgramInfo {
  program: WebGLProgram;
  attribs: Record<string, number>;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

const FULLSCREEN_VS = `#version 300 es
#define VERT
layout(location = 0) in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export function createGLContext(canvas: HTMLCanvasElement): WebGL2RenderingContext {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
    premultipliedAlpha: false,
    desynchronized: true,
  });
  if (!gl) {
    throw new Error("WebGL2 is not supported in this browser. Please use a modern browser (Chrome/Edge/Firefox/Safari 15+).");
  }
  gl.getExtension("EXT_color_buffer_float");
  gl.getExtension("OES_texture_float_linear");
  gl.getExtension("EXT_color_buffer_half_float");
  return gl;
}

export function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to allocate shader object.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "Unknown shader error";
    const labeled = source
      .split("\n")
      .map((line, i) => `${String(i + 1).padStart(3, " ")}| ${line}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`[Shader compile error] type=${type === gl.VERTEX_SHADER ? "VERTEX" : "FRAGMENT"}\n${log}\n\n${labeled}`);
    gl.deleteShader(shader);
    throw new Error(`Shader compile error:\n${log}\n\n${labeled}`);
  }
  return shader;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
  attribNames: string[] = [],
  uniformNames: string[] = [],
): ProgramInfo {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to allocate program object.");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "Unknown program link error";
    gl.deleteProgram(program);
    throw new Error(`Program link error:\n${log}`);
  }
  const attribs: Record<string, number> = {};
  for (const name of attribNames) {
    attribs[name] = gl.getAttribLocation(program, name);
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) {
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, attribs, uniforms };
}

export function createFullscreenProgram(
  gl: WebGL2RenderingContext,
  fragmentSource: string,
  uniformNames: string[] = [],
): ProgramInfo {
  return createProgram(gl, FULLSCREEN_VS, fragmentSource, ["a_pos"], uniformNames);
}

export function createFullscreenVAO(gl: WebGL2RenderingContext): { vao: WebGLVertexArrayObject; vbo: WebGLBuffer } {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  if (!vao || !vbo) throw new Error("Failed to allocate fullscreen VAO.");
  return { vao, vbo };
}

export function drawFullscreen(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject): void {
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.bindVertexArray(null);
}

export interface FloatTextureOpts {
  width: number;
  height: number;
  internalFormat: number;
  format: number;
  type: number;
  minFilter?: number;
  magFilter?: number;
  wrapS?: number;
  wrapT?: number;
}

export function createFloatTexture(gl: WebGL2RenderingContext, opts: FloatTextureOpts): WebGLTexture {
  const tex = gl.createTexture();
  if (!tex) throw new Error("Failed to allocate texture.");
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, opts.internalFormat, opts.width, opts.height, 0, opts.format, opts.type, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.minFilter ?? gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.magFilter ?? gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, opts.wrapS ?? gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, opts.wrapT ?? gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

export function createFramebuffer(gl: WebGL2RenderingContext): WebGLFramebuffer {
  const fb = gl.createFramebuffer();
  if (!fb) throw new Error("Failed to allocate framebuffer.");
  return fb;
}

export function attachTextureToFramebuffer(
  gl: WebGL2RenderingContext,
  fb: WebGLFramebuffer,
  texture: WebGLTexture,
  level = 0,
): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, level);
}

export function checkFramebuffer(gl: WebGL2RenderingContext, label: string): void {
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error(`Framebuffer incomplete (${label}): 0x${status.toString(16)}`);
  }
}

export function setUniform(gl: WebGL2RenderingContext, type: string, loc: WebGLUniformLocation | null, value: unknown): void {
  if (loc === null) return;
  switch (type) {
    case "1f":
      gl.uniform1f(loc, value as number);
      break;
    case "1i":
      gl.uniform1i(loc, value as number);
      break;
    case "2f":
      gl.uniform2fv(loc, value as Float32Array | number[]);
      break;
    case "3f":
      gl.uniform3fv(loc, value as Float32Array | number[]);
      break;
    case "4f":
      gl.uniform4fv(loc, value as Float32Array | number[]);
      break;
    case "1fv":
      gl.uniform1fv(loc, value as Float32Array | number[]);
      break;
    case "Matrix3fv":
      gl.uniformMatrix3fv(loc, false, value as Float32Array);
      break;
    case "Matrix4fv":
      gl.uniformMatrix4fv(loc, false, value as Float32Array);
      break;
    default:
      throw new Error(`Unknown uniform type: ${type}`);
  }
}
