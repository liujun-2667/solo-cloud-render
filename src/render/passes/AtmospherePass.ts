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
  "u_visibility", "u_fogColor", "u_cloudShadowStrength",
  "u_cloudBase", "u_cloudThickness", "u_coverage", "u_noiseFreq", "u_detailStrength", "u_windOffset",
  "u_densityScale",
  "u_cloudNoise",
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

  render(ctx: FrameContext, noiseTex: WebGLTexture, target: WebGLFramebuffer | null, width: number, height: number, jitter: [number, number]): void {
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

    gl.uniform1f(u.u_visibility, ctx.visibility);
    gl.uniform3fv(u.u_fogColor, ctx.fogColor);
    gl.uniform1f(u.u_cloudShadowStrength, ctx.cloudShadowStrength);

    gl.uniform1f(u.u_cloudBase, ctx.cloudBase);
    gl.uniform1f(u.u_cloudThickness, ctx.cloudThickness);
    gl.uniform1f(u.u_coverage, ctx.coverage);
    gl.uniform1f(u.u_noiseFreq, ctx.noiseFreq);
    gl.uniform1f(u.u_detailStrength, ctx.detailStrength);
    gl.uniform3fv(u.u_windOffset, ctx.windOffset);
    gl.uniform1f(u.u_densityScale, ctx.densityScale);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_3D, noiseTex);
    gl.uniform1i(u.u_cloudNoise, 1);

    drawFullscreen(gl, this.vao);
  }
}
