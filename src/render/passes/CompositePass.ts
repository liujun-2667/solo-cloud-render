import {
  createFullscreenProgram,
  drawFullscreen,
  type ProgramInfo,
} from "../GLContext";
import type { FrameContext } from "../frameContext";
import compositeFrag from "../shaders/composite.frag?raw";

const UNIFORMS = [
  "u_cloudTex", "u_atmosphereTex", "u_historyTex", "u_weatherTex",
  "u_resolution", "u_jitter", "u_blendFactor", "u_exposure", "u_starIntensity",
  "u_snowAccumulation", "u_hasWeather",
  "u_camForward", "u_camRight", "u_camUp", "u_tanHalfFov", "u_aspect", "u_time",
];

export class CompositePass {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  private info: ProgramInfo;
  private vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.info = createFullscreenProgram(gl, compositeFrag, UNIFORMS);
    this.program = this.info.program;
    this.vao = vao;
  }

  render(
    ctx: FrameContext,
    cloudTex: WebGLTexture,
    atmosphereTex: WebGLTexture,
    historyTex: WebGLTexture,
    weatherTex: WebGLTexture | null,
    target: WebGLFramebuffer | null,
    width: number,
    height: number,
    jitter: [number, number],
    blendFactor: number,
    snowAccumulation: number,
    hasWeather: boolean,
  ): void {
    const gl = this.gl;
    const u = this.info.uniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.disable(gl.DEPTH_TEST);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, cloudTex);
    gl.uniform1i(u.u_cloudTex, 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, atmosphereTex);
    gl.uniform1i(u.u_atmosphereTex, 1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, historyTex);
    gl.uniform1i(u.u_historyTex, 2);

    gl.activeTexture(gl.TEXTURE3);
    if (weatherTex) {
      gl.bindTexture(gl.TEXTURE_2D, weatherTex);
    } else {
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    gl.uniform1i(u.u_weatherTex, 3);

    gl.uniform2f(u.u_resolution, width, height);
    gl.uniform2f(u.u_jitter, jitter[0], jitter[1]);
    gl.uniform1f(u.u_blendFactor, blendFactor);
    gl.uniform1f(u.u_exposure, ctx.exposure);
    gl.uniform1f(u.u_starIntensity, ctx.starIntensity);
    gl.uniform1f(u.u_snowAccumulation, snowAccumulation);
    gl.uniform1f(u.u_hasWeather, hasWeather ? 1.0 : 0.0);

    gl.uniform3fv(u.u_camForward, ctx.forward);
    gl.uniform3fv(u.u_camRight, ctx.right);
    gl.uniform3fv(u.u_camUp, ctx.up);
    gl.uniform1f(u.u_tanHalfFov, ctx.tanHalfFov);
    gl.uniform1f(u.u_aspect, ctx.aspect);
    gl.uniform1f(u.u_time, ctx.time);

    drawFullscreen(gl, this.vao);
  }
}
