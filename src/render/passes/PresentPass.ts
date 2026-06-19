import {
  createFullscreenProgram,
  drawFullscreen,
  type ProgramInfo,
} from "../GLContext";
import presentFrag from "../shaders/present.frag?raw";

const UNIFORMS = ["u_tex", "u_resolution", "u_vignette"];

export class PresentPass {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  private info: ProgramInfo;
  private vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.info = createFullscreenProgram(gl, presentFrag, UNIFORMS);
    this.program = this.info.program;
    this.vao = vao;
  }

  render(tex: WebGLTexture, width: number, height: number, vignette = 0.45): void {
    const gl = this.gl;
    const u = this.info.uniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.disable(gl.DEPTH_TEST);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(u.u_tex, 0);
    gl.uniform2f(u.u_resolution, width, height);
    gl.uniform1f(u.u_vignette, vignette);

    drawFullscreen(gl, this.vao);
  }
}
