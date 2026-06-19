import {
  createFullscreenProgram,
  drawFullscreen,
  type ProgramInfo,
} from "../GLContext";
import type { FrameContext } from "../frameContext";
import atmosphereFrag from "../shaders/atmosphere.frag?raw";

const UNIFORMS = [
  "u_camPos", "u_camForward", "u_camRight", "u_camUp", "u_tanHalfFov", "u_aspect", "u_resolution", "u_jitter",
  "u_sunDir", "u_sunIntensity", "u_sunColor", "u_sunAngularRadius",
  "u_planetRadius", "u_atmosphereRadius",
  "u_rayleighCoeff", "u_mieCoeff", "u_rayleighScaleHeight", "u_mieScaleHeight", "u_mieG",
  "u_steps", "u_lightSteps", "u_groundColor", "u_exposure",
];

export class AtmospherePass {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  private info: ProgramInfo;
  private vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.info = createFullscreenProgram(gl, atmosphereFrag, UNIFORMS);
    this.program = this.info.program;
    this.vao = vao;
  }

  render(ctx: FrameContext, target: WebGLFramebuffer | null, width: number, height: number, jitter: [number, number]): void {
    const gl = this.gl;
    const u = this.info.uniforms;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.program);
    gl.disable(gl.DEPTH_TEST);

    gl.uniform3fv(u.u_camPos, ctx.camPos);
    gl.uniform3fv(u.u_camForward, ctx.forward);
    gl.uniform3fv(u.u_camRight, ctx.right);
    gl.uniform3fv(u.u_camUp, ctx.up);
    gl.uniform1f(u.u_tanHalfFov, ctx.tanHalfFov);
    gl.uniform1f(u.u_aspect, ctx.aspect);
    gl.uniform2f(u.u_resolution, ctx.resolution[0], ctx.resolution[1]);
    gl.uniform2f(u.u_jitter, jitter[0], jitter[1]);

    gl.uniform3fv(u.u_sunDir, ctx.sunDir);
    gl.uniform1f(u.u_sunIntensity, ctx.sunIntensity);
    gl.uniform3fv(u.u_sunColor, ctx.sunColor);
    gl.uniform1f(u.u_sunAngularRadius, ctx.sunAngularRadius);

    gl.uniform1f(u.u_planetRadius, ctx.planetRadius);
    gl.uniform1f(u.u_atmosphereRadius, ctx.atmosphereRadius);

    gl.uniform3fv(u.u_rayleighCoeff, ctx.rayleighCoeff);
    gl.uniform1f(u.u_mieCoeff, ctx.mieCoeff);
    gl.uniform1f(u.u_rayleighScaleHeight, ctx.rayleighScaleHeight);
    gl.uniform1f(u.u_mieScaleHeight, ctx.mieScaleHeight);
    gl.uniform1f(u.u_mieG, ctx.mieG);
    gl.uniform1i(u.u_steps, ctx.atmosphereSteps);
    gl.uniform1i(u.u_lightSteps, ctx.atmosphereLightSteps);
    gl.uniform3fv(u.u_groundColor, ctx.groundColor);
    gl.uniform1f(u.u_exposure, ctx.exposure);

    drawFullscreen(gl, this.vao);
  }
}
