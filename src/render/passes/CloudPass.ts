import {
  createFullscreenProgram,
  drawFullscreen,
  type ProgramInfo,
} from "../GLContext";
import type { FrameContext } from "../frameContext";
import cloudsFrag from "../shaders/clouds.frag?raw";

const UNIFORMS = [
  "u_camPos", "u_camForward", "u_camRight", "u_camUp", "u_tanHalfFov", "u_aspect", "u_resolution", "u_jitter",
  "u_sunDir", "u_sunColor", "u_sunIntensity", "u_mieG",
  "u_cloudBase", "u_cloudThickness", "u_coverage", "u_noiseFreq", "u_detailStrength",
  "u_windOffset", "u_densityScale", "u_absorption", "u_ambientStrength",
  "u_ambientColor", "u_sunAttenuation",
  "u_cloudSteps", "u_lightSteps", "u_maxDistance", "u_lightStepSize", "u_time",
  "u_checkerIndex",
  "u_cloudNoise",
];

export class CloudPass {
  gl: WebGL2RenderingContext;
  program: WebGLProgram;
  private info: ProgramInfo;
  private vao: WebGLVertexArrayObject;

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.info = createFullscreenProgram(gl, cloudsFrag, UNIFORMS);
    this.program = this.info.program;
    this.vao = vao;
  }

  render(ctx: FrameContext, noiseTex: WebGLTexture, target: WebGLFramebuffer | null, width: number, height: number, jitter: [number, number], checkerIndex = -1): void {
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
    gl.uniform2f(u.u_resolution, ctx.cloudResolution[0], ctx.cloudResolution[1]);
    gl.uniform2f(u.u_jitter, jitter[0], jitter[1]);

    gl.uniform3fv(u.u_sunDir, ctx.sunDir);
    gl.uniform3fv(u.u_sunColor, ctx.sunColor);
    gl.uniform1f(u.u_sunIntensity, ctx.sunIntensity);
    gl.uniform1f(u.u_mieG, ctx.mieG);

    gl.uniform1f(u.u_cloudBase, ctx.cloudBase);
    gl.uniform1f(u.u_cloudThickness, ctx.cloudThickness);
    gl.uniform1f(u.u_coverage, ctx.coverage);
    gl.uniform1f(u.u_noiseFreq, ctx.noiseFreq);
    gl.uniform1f(u.u_detailStrength, ctx.detailStrength);
    gl.uniform3fv(u.u_windOffset, ctx.windOffset);
    gl.uniform1f(u.u_densityScale, ctx.densityScale);
    gl.uniform1f(u.u_absorption, ctx.absorption);
    gl.uniform1f(u.u_ambientStrength, ctx.ambientStrength);
    gl.uniform3fv(u.u_ambientColor, ctx.ambientColor);
    gl.uniform3fv(u.u_sunAttenuation, ctx.sunAttenuation);

    gl.uniform1i(u.u_cloudSteps, ctx.cloudSteps);
    gl.uniform1i(u.u_lightSteps, ctx.cloudLightSteps);
    gl.uniform1f(u.u_maxDistance, ctx.maxDistance);
    gl.uniform1f(u.u_lightStepSize, ctx.lightStepSize);
    gl.uniform1f(u.u_time, ctx.time);
    gl.uniform1i(u.u_checkerIndex, checkerIndex);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_3D, noiseTex);
    gl.uniform1i(u.u_cloudNoise, 0);

    drawFullscreen(gl, this.vao);
  }
}
