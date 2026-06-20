import {
  createProgram,
  createFullscreenProgram,
  drawFullscreen,
  type ProgramInfo,
} from "../GLContext";
import type { FrameContext } from "../frameContext";
import { LightningSystem } from "../LightningSystem";
import { MAX_PARTICLES, MAX_RIPPLES, MAX_LIGHTNING_SEGMENTS } from "../constants";
import type { OrbitCamera } from "../Camera";
import { degToRad } from "@/utils/math";
import particlesVert from "../shaders/particles.vert?raw";
import particlesFrag from "../shaders/particles.frag?raw";
import ripplesVert from "../shaders/ripples.vert?raw";
import ripplesFrag from "../shaders/ripples.frag?raw";
import lightningVert from "../shaders/lightning.vert?raw";
import lightningFrag from "../shaders/lightning.frag?raw";
import lightningFlashFrag from "../shaders/lightning_flash.frag?raw";

const PARTICLE_UNIFORMS = [
  "u_viewProj", "u_camPos", "u_camRight", "u_camUp",
  "u_time", "u_dt", "u_coverage", "u_cloudBase", "u_cloudThickness",
  "u_windX", "u_windZ", "u_windInfluence",
  "u_particleType", "u_fallSpeed", "u_particleLength",
  "u_spawnRate", "u_spawnAreaRadius", "u_groundY",
];

const RIPPLE_UNIFORMS = [
  "u_viewProj", "u_camRight", "u_camUp", "u_time",
];

const LIGHTNING_UNIFORMS = [
  "u_viewProj",
];

const FLASH_UNIFORMS = [
  "u_sceneTex", "u_resolution", "u_flashIntensity",
];

export class WeatherPass {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;

  private particleProgram: ProgramInfo;
  private particleVAO: WebGLVertexArrayObject;
  private particleSeedVBO: WebGLBuffer;
  private particleLifeVBO: WebGLBuffer;

  private rippleProgram: ProgramInfo;
  private rippleVAO: WebGLVertexArrayObject;
  private rippleVBO: WebGLBuffer;
  private rippleData: Float32Array;
  private rippleCount = 0;
  private rippleIndex = 0;

  private lightningProgram: ProgramInfo;
  private lightningVAO: WebGLVertexArrayObject;
  private lightningVBO: WebGLBuffer;

  private flashProgram: ProgramInfo;
  private fullscreenVAO: WebGLVertexArrayObject;

  private lightningSystem: LightningSystem;
  private timeSeconds = 0;
  private prevTime = 0;
  private spawnAreaRadius = 10000;
  private groundY = 0;

  private transitionFactor = 1.0;
  private targetWeather: string = "clear";
  private currentWeather: string = "clear";
  private transitionStart = 0;
  private transitionDuration = 2.0;

  private accumulatedSnow = 0;
  private snowDecayRate = 0.05;

  constructor(gl: WebGL2RenderingContext, vao: WebGLVertexArrayObject) {
    this.gl = gl;
    this.vao = vao;

    this.particleProgram = createProgram(gl, particlesVert, particlesFrag,
      ["a_seed", "a_life"], PARTICLE_UNIFORMS);
    this.rippleProgram = createProgram(gl, ripplesVert, ripplesFrag,
      ["a_rippleData"], RIPPLE_UNIFORMS);
    this.lightningProgram = createProgram(gl, lightningVert, lightningFrag,
      ["a_pos", "a_width", "a_brightness"], LIGHTNING_UNIFORMS);
    this.flashProgram = createFullscreenProgram(gl, lightningFlashFrag, FLASH_UNIFORMS);

    this.particleVAO = this.createParticleBuffers();
    this.rippleVAO = this.createRippleBuffers();
    this.lightningVAO = this.createLightningBuffers();
    this.fullscreenVAO = vao;

    this.lightningSystem = new LightningSystem();

    this.rippleData = new Float32Array(MAX_RIPPLES * 4);
  }

  private createParticleBuffers(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create particle VAO");
    gl.bindVertexArray(vao);

    const seedData = new Float32Array(MAX_PARTICLES * 4);
    const lifeData = new Float32Array(MAX_PARTICLES * 2);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      seedData[i * 4 + 0] = Math.random();
      seedData[i * 4 + 1] = Math.random();
      seedData[i * 4 + 2] = Math.random();
      seedData[i * 4 + 3] = i;
      lifeData[i * 2 + 0] = 0;
      lifeData[i * 2 + 1] = 10;
    }

    this.particleSeedVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleSeedVBO);
    gl.bufferData(gl.ARRAY_BUFFER, seedData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

    this.particleLifeVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.particleLifeVBO);
    gl.bufferData(gl.ARRAY_BUFFER, lifeData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    return vao;
  }

  private createRippleBuffers(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create ripple VAO");
    gl.bindVertexArray(vao);

    this.rippleVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.rippleVBO);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_RIPPLES * 4 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    return vao;
  }

  private createLightningBuffers(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error("Failed to create lightning VAO");
    gl.bindVertexArray(vao);

    this.lightningVBO = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.lightningVBO);
    gl.bufferData(gl.ARRAY_BUFFER, MAX_LIGHTNING_SEGMENTS * 5 * 4, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 20, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 20, 16);

    gl.bindVertexArray(null);
    return vao;
  }

  private buildViewProj(camera: OrbitCamera, width: number, height: number): Float32Array {
    const aspect = width / height;
    const fovRad = degToRad(camera.fov);
    const tanHalfFov = Math.tan(fovRad * 0.5);

    const near = 10;
    const far = 500000;
    const f = 1.0 / tanHalfFov;
    const nf = 1 / (near - far);

    const proj = new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0,
    ]);

    const camPos = camera.position;
    const basis = camera.basis();
    const fx = basis.forward[0], fy = basis.forward[1], fz = basis.forward[2];
    const rx = basis.right[0], ry = basis.right[1], rz = basis.right[2];
    const ux = basis.up[0], uy = basis.up[1], uz = basis.up[2];

    const view = new Float32Array([
      rx, ux, -fx, 0,
      ry, uy, -fy, 0,
      rz, uz, -fz, 0,
      -(rx * camPos[0] + ry * camPos[1] + rz * camPos[2]),
      -(ux * camPos[0] + uy * camPos[1] + uz * camPos[2]),
      fx * camPos[0] + fy * camPos[1] + fz * camPos[2],
      1,
    ]);

    const vp = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += proj[i * 4 + k] * view[k * 4 + j];
        }
        vp[i * 4 + j] = sum;
      }
    }
    return vp;
  }

  addRipple(x: number, y: number, z: number, time: number): void {
    const idx = this.rippleIndex % MAX_RIPPLES;
    this.rippleData[idx * 4 + 0] = x;
    this.rippleData[idx * 4 + 1] = y;
    this.rippleData[idx * 4 + 2] = z;
    this.rippleData[idx * 4 + 3] = time;
    this.rippleIndex++;
    this.rippleCount = Math.min(this.rippleCount + 1, MAX_RIPPLES);
  }

  updateWeatherTransition(ctx: FrameContext, time: number): void {
    if (this.targetWeather !== ctx.weatherType) {
      this.targetWeather = ctx.weatherType;
      this.transitionStart = time;
    }

    const elapsed = time - this.transitionStart;
    if (elapsed < this.transitionDuration) {
      this.transitionFactor = 1.0 - elapsed / this.transitionDuration;
    } else {
      this.transitionFactor = 0;
      this.currentWeather = this.targetWeather;
    }

    if (ctx.weatherType === "snow") {
      this.accumulatedSnow = Math.min(1, this.accumulatedSnow + 0.0005);
    } else {
      this.accumulatedSnow = Math.max(0, this.accumulatedSnow - this.snowDecayRate * 0.001);
    }
  }

  render(
    ctx: FrameContext,
    camera: OrbitCamera,
    target: WebGLFramebuffer | null,
    width: number,
    height: number,
    sceneTex: WebGLTexture,
  ): { hasFlash: boolean; flashIntensity: number; snowAccumulation: number } {
    const gl = this.gl;
    const time = ctx.time;
    const dt = this.prevTime > 0 ? Math.min(0.05, time - this.prevTime) : 0.016;
    this.prevTime = time;

    this.updateWeatherTransition(ctx, time);

    const isStorm = ctx.rainIntensity === "storm";
    this.lightningSystem.update(time, ctx.coverage, isStorm, ctx.lightningEnabled);

    if (this.lightningSystem.shouldTrigger(time) && ctx.weatherType === "rain" && isStorm && ctx.lightningEnabled) {
      this.lightningSystem.tryTrigger(ctx.cloudBase, ctx.cloudThickness, this.spawnAreaRadius);
    }

    const flashIntensity = this.lightningSystem.getFlashIntensity();

    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);

    const viewProj = this.buildViewProj(camera, width, height);
    const camPos = camera.position;
    const basis = camera.basis();

    let activeParticles = 0;
    let particleType = 0;

    if (ctx.weatherType === "rain" || (this.transitionFactor > 0 && this.currentWeather === "rain")) {
      const density = ctx.rainDensityFactor * ctx.particleDensityMultiplier * ctx.coverage;
      const spawnFade = ctx.weatherType === "rain" ? 1.0 : this.transitionFactor;
      activeParticles = Math.floor(MAX_PARTICLES * Math.min(1, density * spawnFade));
      particleType = 0;
    } else if (ctx.weatherType === "snow" || (this.transitionFactor > 0 && this.currentWeather === "snow")) {
      const density = 0.5 * ctx.particleDensityMultiplier * ctx.coverage;
      const spawnFade = ctx.weatherType === "snow" ? 1.0 : this.transitionFactor;
      activeParticles = Math.floor(MAX_PARTICLES * 0.6 * Math.min(1, density * spawnFade));
      particleType = 1;
    }

    if (activeParticles > 0) {
      this.renderParticles(ctx, viewProj, camPos, basis, time, dt, activeParticles, particleType);
    }

    if (particleType === 0 && activeParticles > 0) {
      this.renderRipples(viewProj, basis, time);
    }

    const lightningResult = this.lightningSystem.flattenPositions(time);
    if (lightningResult.count > 0) {
      this.renderLightning(viewProj, lightningResult.positions, lightningResult.count);
    }

    gl.disable(gl.BLEND);

    let finalSnowAccum = ctx.snowAccumulation;
    if (ctx.weatherType === "snow") {
      finalSnowAccum = Math.min(1, finalSnowAccum + this.accumulatedSnow * 0.3);
    }

    return {
      hasFlash: flashIntensity > 0,
      flashIntensity,
      snowAccumulation: finalSnowAccum,
    };
  }

  private renderParticles(
    ctx: FrameContext,
    viewProj: Float32Array,
    camPos: number[],
    basis: { right: number[]; up: number[] },
    time: number,
    dt: number,
    count: number,
    type: number,
  ): void {
    const gl = this.gl;
    const u = this.particleProgram.uniforms;

    gl.useProgram(this.particleProgram.program);
    gl.bindVertexArray(this.particleVAO);

    gl.uniformMatrix4fv(u.u_viewProj, false, viewProj);
    gl.uniform3fv(u.u_camPos, camPos);
    gl.uniform3fv(u.u_camRight, basis.right);
    gl.uniform3fv(u.u_camUp, basis.up);
    gl.uniform1f(u.u_time, time);
    gl.uniform1f(u.u_dt, dt);
    gl.uniform1f(u.u_coverage, ctx.coverage);
    gl.uniform1f(u.u_cloudBase, ctx.cloudBase);
    gl.uniform1f(u.u_cloudThickness, ctx.cloudThickness);
    gl.uniform1f(u.u_windX, ctx.windVec[0]);
    gl.uniform1f(u.u_windZ, ctx.windVec[2]);
    gl.uniform1f(u.u_windInfluence, ctx.windParticleInfluence);
    gl.uniform1i(u.u_particleType, type);
    gl.uniform1f(u.u_fallSpeed, type === 0 ? ctx.rainFallSpeed : ctx.rainFallSpeed * 0.25);
    gl.uniform1f(u.u_particleLength, type === 0 ? ctx.rainParticleLength : 4);
    gl.uniform1f(u.u_spawnRate, count / 5.0);
    gl.uniform1f(u.u_spawnAreaRadius, this.spawnAreaRadius);
    gl.uniform1f(u.u_groundY, this.groundY);

    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
  }

  private renderRipples(
    viewProj: Float32Array,
    basis: { right: number[]; up: number[] },
    time: number,
  ): void {
    const gl = this.gl;
    const u = this.rippleProgram.uniforms;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.rippleVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.rippleData);

    gl.useProgram(this.rippleProgram.program);
    gl.bindVertexArray(this.rippleVAO);

    gl.uniformMatrix4fv(u.u_viewProj, false, viewProj);
    gl.uniform3fv(u.u_camRight, basis.right);
    gl.uniform3fv(u.u_camUp, basis.up);
    gl.uniform1f(u.u_time, time);

    gl.drawArrays(gl.POINTS, 0, Math.min(this.rippleCount, MAX_RIPPLES));
    gl.bindVertexArray(null);
  }

  private renderLightning(
    viewProj: Float32Array,
    positions: Float32Array,
    count: number,
  ): void {
    const gl = this.gl;
    const u = this.lightningProgram.uniforms;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lightningVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

    gl.useProgram(this.lightningProgram.program);
    gl.bindVertexArray(this.lightningVAO);

    gl.uniformMatrix4fv(u.u_viewProj, false, viewProj);

    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
  }

  renderFlash(
    target: WebGLFramebuffer | null,
    width: number,
    height: number,
    sceneTex: WebGLTexture,
    flashIntensity: number,
  ): void {
    if (flashIntensity <= 0.001) return;

    const gl = this.gl;
    const u = this.flashProgram.uniforms;

    gl.bindFramebuffer(gl.FRAMEBUFFER, target);
    gl.viewport(0, 0, width, height);
    gl.useProgram(this.flashProgram.program);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    gl.uniform1i(u.u_sceneTex, 0);
    gl.uniform2f(u.u_resolution, width, height);
    gl.uniform1f(u.u_flashIntensity, flashIntensity);

    drawFullscreen(gl, this.fullscreenVAO);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.particleProgram.program);
    gl.deleteProgram(this.rippleProgram.program);
    gl.deleteProgram(this.lightningProgram.program);
    gl.deleteProgram(this.flashProgram.program);
    gl.deleteBuffer(this.particleSeedVBO);
    gl.deleteBuffer(this.particleLifeVBO);
    gl.deleteBuffer(this.rippleVBO);
    gl.deleteBuffer(this.lightningVBO);
    gl.deleteVertexArray(this.particleVAO);
    gl.deleteVertexArray(this.rippleVAO);
    gl.deleteVertexArray(this.lightningVAO);
  }
}
