import {
  createProgram,
  createFullscreenProgram,
  drawFullscreen,
  type ProgramInfo,
} from "../GLContext";
import type { FrameContext } from "../frameContext";
import { LightningSystem } from "../LightningSystem";
import { MAX_PARTICLES, MAX_RIPPLES, MAX_LIGHTNING_SEGMENTS, RAIN_CONFIG } from "../constants";
import type { OrbitCamera } from "../Camera";
import { degToRad } from "@/utils/math";
import particlesVert from "../shaders/particles.vert?raw";
import particlesFrag from "../shaders/particles.frag?raw";
import ripplesVert from "../shaders/ripples.vert?raw";
import ripplesFrag from "../shaders/ripples.frag?raw";
import lightningVert from "../shaders/lightning.vert?raw";
import lightningFrag from "../shaders/lightning.frag?raw";
import lightningFlashFrag from "../shaders/lightning_flash.frag?raw";
import type { WeatherType, RainIntensity } from "@/types";

const PARTICLE_UNIFORMS = [
  "u_viewProj", "u_camPos", "u_camRight", "u_camUp",
  "u_time", "u_dt", "u_coverage", "u_cloudBase", "u_cloudThickness",
  "u_windX", "u_windZ", "u_windInfluence",
  "u_particleType", "u_fallSpeed", "u_particleLength",
  "u_spawnRate", "u_spawnAreaRadius", "u_groundY",
  "u_alphaMultiplier",
];

const RIPPLE_UNIFORMS = [
  "u_viewProj", "u_camRight", "u_camUp", "u_time", "u_camPos",
];

const LIGHTNING_UNIFORMS = [
  "u_viewProj", "u_camPos",
];

const FLASH_UNIFORMS = [
  "u_sceneTex", "u_resolution", "u_flashIntensity",
];

interface WeatherState {
  type: WeatherType;
  rainIntensity: RainIntensity;
  densityMultiplier: number;
  windInfluence: number;
  spawnFactor: number;
}

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
  private spawnAreaRadius = 3000;
  private groundY = 0;

  private currentWeather: WeatherState;
  private prevWeather: WeatherState | null = null;
  private transitionStart = 0;
  private transitionDuration = 3.0;
  private isTransitioning = false;

  private accumulatedSnow = 0;
  private snowDecayRate = 0.05;

  private baseCoverage = 0.45;
  private baseWindSpeed = 0.6;
  private weatherCoverageOffset = 0;
  private weatherWindMultiplier = 1;
  private coverageTransitionSpeed = 0.3;

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

    this.currentWeather = {
      type: "clear",
      rainIntensity: "moderate",
      densityMultiplier: 1.0,
      windInfluence: 1.0,
      spawnFactor: 0,
    };
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

  setTransitionDuration(duration: number): void {
    this.transitionDuration = Math.max(0.5, Math.min(10, duration));
  }

  getTransitionDuration(): number {
    return this.transitionDuration;
  }

  setWeatherState(
    type: WeatherType,
    rainIntensity: RainIntensity,
    densityMultiplier: number,
    windInfluence: number,
    time: number,
  ): void {
    if (this.currentWeather.type === type &&
        this.currentWeather.rainIntensity === rainIntensity &&
        this.currentWeather.densityMultiplier === densityMultiplier &&
        this.currentWeather.windInfluence === windInfluence &&
        !this.isTransitioning) {
      return;
    }

    if (this.isTransitioning && this.prevWeather) {
      this.prevWeather = { ...this.currentWeather, spawnFactor: this.currentWeather.spawnFactor };
    } else {
      this.prevWeather = { ...this.currentWeather, spawnFactor: 1.0 };
    }

    this.currentWeather = {
      type,
      rainIntensity,
      densityMultiplier,
      windInfluence,
      spawnFactor: 0,
    };

    this.transitionStart = time;
    this.isTransitioning = true;
  }

  private updateTransition(time: number, dt: number): void {
    if (!this.isTransitioning) {
      this.currentWeather.spawnFactor = 1.0;
      return;
    }

    const elapsed = time - this.transitionStart;
    const t = Math.min(1, elapsed / this.transitionDuration);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    this.currentWeather.spawnFactor = eased;
    if (this.prevWeather) {
      this.prevWeather.spawnFactor = 1.0 - eased;
    }

    if (t >= 1.0) {
      this.isTransitioning = false;
      this.prevWeather = null;
      this.currentWeather.spawnFactor = 1.0;
    }
  }

  private updateWeatherCloudEffects(ctx: FrameContext, dt: number): void {
    const targetType = this.currentWeather.type;
    const targetIntensity = this.currentWeather.rainIntensity;

    let targetCoverageOffset = 0;
    let targetWindMultiplier = 1;

    if (targetType === "rain") {
      if (targetIntensity === "storm") {
        targetCoverageOffset = Math.max(0, 0.9 - this.baseCoverage);
        targetWindMultiplier = 1.5;
      } else if (targetIntensity === "heavy") {
        targetCoverageOffset = Math.max(0, 0.8 - this.baseCoverage);
        targetWindMultiplier = 1.3;
      } else {
        targetCoverageOffset = Math.max(0, 0.7 - this.baseCoverage);
        targetWindMultiplier = 1.2;
      }
    } else if (targetType === "snow") {
      const midCoverage = 0.6;
      targetCoverageOffset = midCoverage - this.baseCoverage;
      targetWindMultiplier = 0.8;
    } else {
      targetCoverageOffset = 0;
      targetWindMultiplier = 1;
    }

    const transitionAmount = this.coverageTransitionSpeed * dt;
    if (this.weatherCoverageOffset < targetCoverageOffset) {
      this.weatherCoverageOffset = Math.min(targetCoverageOffset, this.weatherCoverageOffset + transitionAmount);
    } else {
      this.weatherCoverageOffset = Math.max(targetCoverageOffset, this.weatherCoverageOffset - transitionAmount);
    }

    if (this.weatherWindMultiplier < targetWindMultiplier) {
      this.weatherWindMultiplier = Math.min(targetWindMultiplier, this.weatherWindMultiplier + transitionAmount * 0.5);
    } else {
      this.weatherWindMultiplier = Math.max(targetWindMultiplier, this.weatherWindMultiplier - transitionAmount * 0.5);
    }
  }

  setBaseParams(baseCoverage: number, baseWindSpeed: number): void {
    this.baseCoverage = baseCoverage;
    this.baseWindSpeed = baseWindSpeed;
  }

  getWeatherCoverageOffset(): number {
    return this.weatherCoverageOffset;
  }

  getWeatherWindMultiplier(): number {
    return this.weatherWindMultiplier;
  }

  private getParticleCount(weather: WeatherState, ctx: FrameContext): number {
    if (weather.type === "clear" || weather.spawnFactor <= 0) return 0;

    const rainCfg = RAIN_CONFIG[weather.rainIntensity] ?? RAIN_CONFIG.moderate;
    const baseDensity = weather.type === "rain" ? rainCfg.density : 0.5;
    const density = baseDensity * weather.densityMultiplier * ctx.particleDensityMultiplier * Math.max(0.3, ctx.coverage);
    const maxCount = weather.type === "rain" ? MAX_PARTICLES : Math.floor(MAX_PARTICLES * 0.6);
    const count = Math.floor(maxCount * Math.min(1, density * weather.spawnFactor));

    return Math.max(0, count);
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

    this.updateTransition(time, dt);
    this.updateWeatherCloudEffects(ctx, dt);

    const isStorm = this.currentWeather.type === "rain" && this.currentWeather.rainIntensity === "storm";
    this.lightningSystem.update(
      time,
      ctx.coverage + this.weatherCoverageOffset,
      isStorm,
      ctx.lightningEnabled,
      ctx.cloudBase,
      ctx.cloudThickness,
      this.spawnAreaRadius,
    );

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

    if (this.prevWeather && this.prevWeather.spawnFactor > 0 && this.prevWeather.type !== "clear") {
      const count = this.getParticleCount(this.prevWeather, ctx);
      if (count > 0) {
        this.renderWeatherParticles(ctx, viewProj, camPos, basis, time, dt, count, this.prevWeather);
      }
    }

    if (this.currentWeather.spawnFactor > 0 && this.currentWeather.type !== "clear") {
      const count = this.getParticleCount(this.currentWeather, ctx);
      if (count > 0) {
        this.renderWeatherParticles(ctx, viewProj, camPos, basis, time, dt, count, this.currentWeather);
      }
    }

    const hasRain = this.currentWeather.type === "rain" || (this.prevWeather?.type === "rain" && this.prevWeather.spawnFactor > 0);
    const rainFactor = Math.max(
      this.currentWeather.type === "rain" ? this.currentWeather.spawnFactor : 0,
      this.prevWeather?.type === "rain" ? this.prevWeather.spawnFactor : 0,
    );
    if (hasRain && rainFactor > 0) {
      this.updateRipples(ctx, camPos, time, rainFactor);
      this.renderRipples(viewProj, basis, camPos, time);
    }

    const lightningResult = this.lightningSystem.flattenPositions(time);
    if (lightningResult.count > 0) {
      this.renderLightning(viewProj, camPos, lightningResult.positions, lightningResult.count);
    }

    gl.disable(gl.BLEND);

    if (this.currentWeather.type === "snow") {
      this.accumulatedSnow = Math.min(1, this.accumulatedSnow + 0.0005 * this.currentWeather.spawnFactor);
    } else {
      this.accumulatedSnow = Math.max(0, this.accumulatedSnow - this.snowDecayRate * 0.001);
    }

    let finalSnowAccum = ctx.snowAccumulation;
    if (this.currentWeather.type === "snow" || (this.prevWeather?.type === "snow" && this.prevWeather.spawnFactor > 0.1)) {
      finalSnowAccum = Math.min(1, finalSnowAccum + this.accumulatedSnow * 0.3);
    }

    return {
      hasFlash: flashIntensity > 0,
      flashIntensity,
      snowAccumulation: finalSnowAccum,
    };
  }

  private renderWeatherParticles(
    ctx: FrameContext,
    viewProj: Float32Array,
    camPos: number[],
    basis: { right: number[]; up: number[] },
    time: number,
    dt: number,
    count: number,
    weather: WeatherState,
  ): void {
    const gl = this.gl;
    const u = this.particleProgram.uniforms;
    const rainCfg = RAIN_CONFIG[weather.rainIntensity] ?? RAIN_CONFIG.moderate;

    const particleType = weather.type === "rain" ? 0 : 1;
    const fallSpeed = weather.type === "rain" ? rainCfg.fallSpeed : rainCfg.fallSpeed * 0.4;
    const particleLength = weather.type === "rain" ? rainCfg.length : 4;

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
    gl.uniform1f(u.u_windInfluence, weather.windInfluence * ctx.windParticleInfluence);
    gl.uniform1i(u.u_particleType, particleType);
    gl.uniform1f(u.u_fallSpeed, fallSpeed);
    gl.uniform1f(u.u_particleLength, particleLength);
    gl.uniform1f(u.u_spawnRate, count / 5.0);
    gl.uniform1f(u.u_spawnAreaRadius, this.spawnAreaRadius);
    gl.uniform1f(u.u_groundY, this.groundY);

    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);
  }

  private updateRipples(ctx: FrameContext, camPos: number[], time: number, intensityFactor: number): void {
    const rainCfg = RAIN_CONFIG[this.currentWeather.rainIntensity] ?? RAIN_CONFIG.moderate;
    const baseRipples = Math.floor(rainCfg.density * 15 * ctx.particleDensityMultiplier);
    const ripplesPerFrame = Math.floor(baseRipples * intensityFactor);
    const radius = this.spawnAreaRadius * 0.7;

    for (let i = 0; i < ripplesPerFrame; i++) {
      const r1 = Math.random();
      const r2 = Math.random();
      const angle = r1 * Math.PI * 2;
      const r = Math.sqrt(r2) * radius;

      const x = camPos[0] + Math.cos(angle) * r;
      const z = camPos[2] + Math.sin(angle) * r;

      this.rippleData[this.rippleIndex * 4 + 0] = x;
      this.rippleData[this.rippleIndex * 4 + 1] = this.groundY;
      this.rippleData[this.rippleIndex * 4 + 2] = z;
      this.rippleData[this.rippleIndex * 4 + 3] = time;

      this.rippleIndex = (this.rippleIndex + 1) % MAX_RIPPLES;
      this.rippleCount = Math.min(this.rippleCount + 1, MAX_RIPPLES);
    }
  }

  private renderRipples(
    viewProj: Float32Array,
    basis: { right: number[]; up: number[] },
    camPos: number[],
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
    gl.uniform3fv(u.u_camPos, camPos);

    gl.drawArrays(gl.POINTS, 0, Math.min(this.rippleCount, MAX_RIPPLES));
    gl.bindVertexArray(null);
  }

  private renderLightning(
    viewProj: Float32Array,
    camPos: number[],
    positions: Float32Array,
    count: number,
  ): void {
    const gl = this.gl;
    const u = this.lightningProgram.uniforms;

    gl.bindBuffer(gl.ARRAY_BUFFER, this.lightningVBO);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, positions);

    gl.useProgram(this.lightningProgram.program);
    gl.bindVertexArray(this.lightningVAO);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE);

    gl.uniformMatrix4fv(u.u_viewProj, false, viewProj);
    gl.uniform3fv(u.u_camPos, camPos);

    gl.drawArrays(gl.POINTS, 0, count);
    gl.bindVertexArray(null);

    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
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
