import type { RenderParams, CameraState, RenderStats, WeatherType, RainIntensity } from "@/types";
import { OrbitCamera } from "./Camera";
import {
  createGLContext,
  createFullscreenVAO,
  createFloatTexture,
  createFramebuffer,
  attachTextureToFramebuffer,
  checkFramebuffer,
} from "./GLContext";
import { NoiseTextureGenerator } from "./NoiseTexture";
import { buildFrameContext, type FrameContext } from "./frameContext";
import { AtmospherePass } from "./passes/AtmospherePass";
import { CloudPass } from "./passes/CloudPass";
import { CompositePass } from "./passes/CompositePass";
import { PresentPass } from "./passes/PresentPass";
import { WeatherPass } from "./passes/WeatherPass";

interface RenderTargets {
  cloudTex: WebGLTexture;
  cloudFB: WebGLFramebuffer;
  cloudHistoryTex: WebGLTexture;
  cloudHistoryFB: WebGLFramebuffer;
  atmosphereTex: WebGLTexture;
  atmosphereFB: WebGLFramebuffer;
  weatherTex: WebGLTexture;
  weatherFB: WebGLFramebuffer;
  historyA: WebGLTexture;
  historyB: WebGLTexture;
  historyAFB: WebGLFramebuffer;
  historyBFB: WebGLFramebuffer;
  width: number;
  height: number;
  cloudWidth: number;
  cloudHeight: number;
}

export interface RendererOptions {
  noiseSize?: number;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  readonly gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;
  private noiseGen: NoiseTextureGenerator;
  private noiseTex: WebGLTexture;
  private atmospherePass: AtmospherePass;
  private cloudPass: CloudPass;
  private compositePass: CompositePass;
  private presentPass: PresentPass;
  private weatherPass: WeatherPass;
  private targets: RenderTargets | null = null;

  private frameIndex = 0;
  private historyIndex = 0;
  private prevCameraKey = "";
  private staticFrames = 0;
  private checkerFrame = 0;
  private hasValidClouds = false;
  private firstFrame = true;
  private lastCloudMs = 0;
  private lastWeatherMs = 0;

  onStats: ((stats: RenderStats) => void) | null = null;

  setWeatherState(
    type: WeatherType,
    rainIntensity: RainIntensity,
    densityMultiplier: number,
    windInfluence: number,
    time: number,
  ): void {
    this.weatherPass.setWeatherState(type, rainIntensity, densityMultiplier, windInfluence, time);
  }

  setWeatherTransitionDuration(duration: number): void {
    this.weatherPass.setTransitionDuration(duration);
  }

  getWeatherCoverageOffset(): number {
    return this.weatherPass.getWeatherCoverageOffset();
  }

  getWeatherWindMultiplier(): number {
    return this.weatherPass.getWeatherWindMultiplier();
  }

  setBaseWeatherParams(baseCoverage: number, baseWindSpeed: number): void {
    this.weatherPass.setBaseParams(baseCoverage, baseWindSpeed);
  }

  constructor(canvas: HTMLCanvasElement, options: RendererOptions = {}) {
    this.canvas = canvas;
    this.gl = createGLContext(canvas);
    const { vao } = createFullscreenVAO(this.gl);
    this.vao = vao;

    this.noiseGen = new NoiseTextureGenerator(this.gl);
    this.noiseTex = this.noiseGen.generate({
      size: options.noiseSize ?? 128,
      seed: 1337,
      baseFreq: 2.2,
      octaves: 4,
      detailScale: 4.0,
    });

    this.atmospherePass = new AtmospherePass(this.gl, this.vao);
    this.cloudPass = new CloudPass(this.gl, this.vao);
    this.compositePass = new CompositePass(this.gl, this.vao);
    this.presentPass = new PresentPass(this.gl, this.vao);
    this.weatherPass = new WeatherPass(this.gl, this.vao);
  }

  resize(displayWidth: number, displayHeight: number, resolutionScale: number): void {
    const gl = this.gl;
    const scale = Math.max(0.25, Math.min(1.5, resolutionScale));
    const w = Math.max(1, Math.round(displayWidth * scale));
    const h = Math.max(1, Math.round(displayHeight * scale));
    // Cloud resolution scale adapts to overall quality:
    // at 100% scale clouds are 0.5x, at 25% scale clouds are 0.25x (even lower for perf).
    const cloudScale = 0.25 + scale * 0.25;
    const cw = Math.max(1, Math.round(w * cloudScale));
    const ch = Math.max(1, Math.round(h * cloudScale));

    if (this.targets && this.targets.width === w && this.targets.height === h &&
        this.targets.cloudWidth === cw && this.targets.cloudHeight === ch) {
      return;
    }

    this.disposeTargets();
    this.canvas.width = w;
    this.canvas.height = h;

    const cloudTex = createFloatTexture(gl, {
      width: cw, height: ch,
      internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT,
    });
    const cloudFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, cloudFB, cloudTex);
    checkFramebuffer(gl, "cloud");

    const cloudHistoryTex = createFloatTexture(gl, {
      width: cw, height: ch,
      internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT,
    });
    const cloudHistoryFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, cloudHistoryFB, cloudHistoryTex);
    checkFramebuffer(gl, "cloudHistory");

    const atmosphereTex = createFloatTexture(gl, {
      width: w, height: h,
      internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT,
    });
    const atmosphereFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, atmosphereFB, atmosphereTex);
    checkFramebuffer(gl, "atmosphere");

    const weatherTex = createFloatTexture(gl, {
      width: w, height: h,
      internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT,
    });
    const weatherFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, weatherFB, weatherTex);
    checkFramebuffer(gl, "weather");

    const historyA = createFloatTexture(gl, {
      width: w, height: h,
      internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE,
    });
    const historyB = createFloatTexture(gl, {
      width: w, height: h,
      internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE,
    });
    const historyAFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, historyAFB, historyA);
    checkFramebuffer(gl, "historyA");
    const historyBFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, historyBFB, historyB);
    checkFramebuffer(gl, "historyB");

    this.targets = {
      cloudTex, cloudFB, cloudHistoryTex, cloudHistoryFB,
      atmosphereTex, atmosphereFB,
      weatherTex, weatherFB,
      historyA, historyB, historyAFB, historyBFB,
      width: w, height: h, cloudWidth: cw, cloudHeight: ch,
    };
    // Clear history textures to black so the first TAA frame does not read garbage.
    gl.bindFramebuffer(gl.FRAMEBUFFER, historyAFB);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, historyBFB);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, cloudHistoryFB);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.hasValidClouds = false;
    this.staticFrames = 0;
    this.firstFrame = true;
  }

  renderFrame(params: RenderParams, camera: CameraState, time: number): void {
    if (!this.targets) return;
    const gl = this.gl;
    const t = this.targets;
    const cam = new OrbitCamera(camera);

    // Quality scaling: lower resolution → fewer ray-march steps for better perf.
    // Use resolutionScale from params (1.0 = full quality, 0.25 = lowest quality).
    const qualityScale = Math.max(0.25, Math.min(1.0, params.resolutionScale));
    const adjustedParams = this.applyQualityScale(params, qualityScale);

    const ctx = buildFrameContext(adjustedParams, cam, t.width, t.height, t.cloudWidth, t.cloudHeight, time);

    // Detect camera motion to adapt TAA blend and temporal cloud reuse.
    const cameraKey = `${cam.azimuth.toFixed(3)}|${cam.elevation.toFixed(3)}|${cam.fov.toFixed(3)}`;
    const moved = cameraKey !== this.prevCameraKey;
    this.prevCameraKey = cameraKey;
    if (moved) {
      this.staticFrames = 0;
      this.checkerFrame = 0;
    } else {
      this.staticFrames++;
    }

    const jitter = this.computeJitter(t.width, t.height);

    // Pass 1: volumetric clouds at reduced resolution with checkerboard temporal reuse.
    const useCheckerboard = this.staticFrames > 2 && this.hasValidClouds;
    let cloudMs = this.lastCloudMs;

    if (!useCheckerboard) {
      const s0 = performance.now();
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.cloudHistoryFB);
      gl.viewport(0, 0, t.cloudWidth, t.cloudHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.cloudPass.render(ctx, this.noiseTex, t.cloudHistoryFB, t.cloudWidth, t.cloudHeight, jitter, -1);
      gl.flush();
      cloudMs = performance.now() - s0;
      this.lastCloudMs = cloudMs;
      this.hasValidClouds = true;
    } else {
      const checkerIndex = this.checkerFrame % 16;
      const s0 = performance.now();
      this.cloudPass.render(ctx, this.noiseTex, t.cloudHistoryFB, t.cloudWidth, t.cloudHeight, jitter, checkerIndex);
      gl.flush();
      const actualMs = performance.now() - s0;
      cloudMs = actualMs * 16;
      this.lastCloudMs = cloudMs;
    }
    this.checkerFrame++;

    // Pass 2: atmospheric scattering at full resolution.
    const a0 = performance.now();
    this.atmospherePass.render(ctx, this.noiseTex, t.atmosphereFB, t.width, t.height, jitter);
    gl.flush();
    const atmosphereMs = performance.now() - a0;

    // Pass 3: weather particles (rain/snow/lightning) rendered separately before composite.
    const w0 = performance.now();
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.weatherFB);
    gl.viewport(0, 0, t.width, t.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const weatherResult = this.weatherPass.render(
      ctx, cam, t.weatherFB, t.width, t.height, t.historyA,
    );
    gl.flush();
    const weatherMs = performance.now() - w0;
    this.lastWeatherMs = weatherMs;

    const hasWeather = ctx.weatherType !== "clear";
    const finalSnowAccum = weatherResult.snowAccumulation;

    // Pass 4: composite + TAA (blends weather particles and applies snow accumulation).
    const readHistory = this.historyIndex === 0 ? t.historyA : t.historyB;
    const writeHistory = this.historyIndex === 0 ? t.historyB : t.historyA;
    const writeFB = this.historyIndex === 0 ? t.historyBFB : t.historyAFB;
    const blendFactor = this.firstFrame ? 1.0 : moved ? 0.5 : this.staticFrames > 6 ? 0.1 : 0.25;

    const c0 = performance.now();
    this.compositePass.render(
      ctx, t.cloudHistoryTex, t.atmosphereTex, readHistory, t.weatherTex, writeFB,
      t.width, t.height, jitter, blendFactor, finalSnowAccum, hasWeather,
    );
    gl.flush();
    const compositeMs = performance.now() - c0;
    this.historyIndex = 1 - this.historyIndex;
    this.firstFrame = false;

    // Pass 5: present to the default framebuffer with vignette.
    // If lightning flash, apply it as a fullscreen brighten effect.
    const p0 = performance.now();
    if (weatherResult.hasFlash && weatherResult.flashIntensity > 0.01) {
      this.weatherPass.renderFlash(
        null, t.width, t.height, writeHistory, weatherResult.flashIntensity,
      );
    } else {
      this.presentPass.render(writeHistory, this.canvas.width, this.canvas.height, 0.4);
    }
    const presentMs = performance.now() - p0;

    this.frameIndex++;
    if (this.onStats) {
      this.onStats({
        fps: 0,
        frameMs: cloudMs + atmosphereMs + weatherMs + compositeMs + presentMs,
        cloudMs,
        atmosphereMs,
        compositeMs: compositeMs + presentMs,
        resolution: [t.width, t.height],
      });
    }
  }

  private applyQualityScale(params: RenderParams, scale: number): RenderParams {
    // Non-linear scaling: steps drop faster at lower quality for bigger perf gains.
    const stepScale = Math.pow(scale, 0.7);
    return {
      ...params,
      atmosphereSteps: Math.max(8, Math.round(params.atmosphereSteps * stepScale)),
      cloudSteps: Math.max(16, Math.round(params.cloudSteps * stepScale)),
    };
  }

  private computeJitter(w: number, h: number): [number, number] {
    const hx = halton(this.frameIndex + 1, 2) - 0.5;
    const hy = halton(this.frameIndex + 1, 3) - 0.5;
    return [hx / w, hy / h];
  }

  /**
   * Render a high-resolution supersampled frame and return it as a PNG blob.
   * Renders multiple jittered samples and accumulates them via the TAA path
   * (ping-pong) for clean anti-aliasing. Does not touch the live render targets.
   */
  async screenshot(
    params: RenderParams,
    camera: CameraState,
    targetWidth: number,
    targetHeight: number,
    samples = 6,
  ): Promise<Blob> {
    const gl = this.gl;
    const cam = new OrbitCamera(camera);
    const cw = Math.max(1, Math.round(targetWidth * 0.5));
    const ch = Math.max(1, Math.round(targetHeight * 0.5));

    const cloudTex = createFloatTexture(gl, {
      width: cw, height: ch,
      internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT,
    });
    const cloudFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, cloudFB, cloudTex);

    const atmosphereTex = createFloatTexture(gl, {
      width: targetWidth, height: targetHeight,
      internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT,
    });
    const atmosphereFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, atmosphereFB, atmosphereTex);

    const accumA = createFloatTexture(gl, {
      width: targetWidth, height: targetHeight,
      internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE,
    });
    const accumB = createFloatTexture(gl, {
      width: targetWidth, height: targetHeight,
      internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE,
    });
    const accumAFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, accumAFB, accumA);
    const accumBFB = createFramebuffer(gl);
    attachTextureToFramebuffer(gl, accumBFB, accumB);
    checkFramebuffer(gl, "screenshot-accum");

    // Clear both accumulation buffers to black.
    gl.bindFramebuffer(gl.FRAMEBUFFER, accumAFB);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, accumBFB);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const ctx = buildFrameContext(params, cam, targetWidth, targetHeight, cw, ch, performance.now());

    let readAccum = accumA;
    let writeAccum = accumB;
    let writeFB = accumBFB;
    for (let i = 0; i < samples; i++) {
      const jitter: [number, number] = [
        (halton(i + 1, 2) - 0.5) / targetWidth,
        (halton(i + 1, 3) - 0.5) / targetHeight,
      ];
      this.cloudPass.render(ctx, this.noiseTex, cloudFB, cw, ch, jitter);
      this.atmospherePass.render(ctx, this.noiseTex, atmosphereFB, targetWidth, targetHeight, jitter);
      // Accumulate as an EMA with blend = 1/samples for an approximate average.
      this.compositePass.render(
        ctx, cloudTex, atmosphereTex, readAccum, null, writeFB,
        targetWidth, targetHeight, jitter, 1 / samples, 0, false,
      );
      // Ping-pong.
      const tmp = readAccum;
      readAccum = writeAccum;
      writeAccum = tmp;
      writeFB = writeAccum === accumA ? accumAFB : accumBFB;
      await new Promise((r) => setTimeout(r, 0));
    }

    // The last frame written is now in `readAccum` (after the final swap).
    const finalTex = readAccum;
    const finalFB = finalTex === accumA ? accumAFB : accumBFB;
    gl.bindFramebuffer(gl.FRAMEBUFFER, finalFB);
    const pixels = new Uint8Array(targetWidth * targetHeight * 4);
    gl.readPixels(0, 0, targetWidth, targetHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

    // Flip vertically (GL origin is bottom-left).
    const flipped = new Uint8Array(pixels.length);
    for (let y = 0; y < targetHeight; y++) {
      const src = (targetHeight - 1 - y) * targetWidth * 4;
      const dst = y * targetWidth * 4;
      flipped.set(pixels.subarray(src, src + targetWidth * 4), dst);
    }

    const blob = await encodePNG(flipped, targetWidth, targetHeight);

    // Cleanup local resources.
    gl.deleteTexture(cloudTex);
    gl.deleteFramebuffer(cloudFB);
    gl.deleteTexture(atmosphereTex);
    gl.deleteFramebuffer(atmosphereFB);
    gl.deleteTexture(accumA);
    gl.deleteTexture(accumB);
    gl.deleteFramebuffer(accumAFB);
    gl.deleteFramebuffer(accumBFB);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    return blob;
  }

  dispose(): void {
    const gl = this.gl;
    this.disposeTargets();
    gl.deleteTexture(this.noiseTex);
    this.noiseGen.dispose();
    this.weatherPass.dispose();
  }

  private disposeTargets(): void {
    if (!this.targets) return;
    const gl = this.gl;
    const t = this.targets;
    gl.deleteTexture(t.cloudTex);
    gl.deleteFramebuffer(t.cloudFB);
    gl.deleteTexture(t.cloudHistoryTex);
    gl.deleteFramebuffer(t.cloudHistoryFB);
    gl.deleteTexture(t.atmosphereTex);
    gl.deleteFramebuffer(t.atmosphereFB);
    gl.deleteTexture(t.weatherTex);
    gl.deleteFramebuffer(t.weatherFB);
    gl.deleteTexture(t.historyA);
    gl.deleteTexture(t.historyB);
    gl.deleteFramebuffer(t.historyAFB);
    gl.deleteFramebuffer(t.historyBFB);
    this.targets = null;
  }
}

function halton(index: number, base: number): number {
  let f = 1;
  let r = 0;
  let i = index;
  while (i > 0) {
    f /= base;
    r += f * (i % base);
    i = Math.floor(i / base);
  }
  return r;
}

async function encodePNG(pixels: Uint8Array, width: number, height: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx2d = canvas.getContext("2d")!;
  const imageData = ctx2d.createImageData(width, height);
  imageData.data.set(pixels);
  ctx2d.putImageData(imageData, 0, 0);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png");
  });
}
