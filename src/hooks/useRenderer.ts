import { useEffect, useRef } from "react";
import { Renderer } from "@/render/Renderer";
import { useParamsStore } from "@/store/renderParams";
import { useCameraStore } from "@/store/camera";
import { useStatsStore } from "@/store/stats";
import { useTimelineStore } from "@/store/timeline";
import type { Renderer as RendererType } from "@/render/Renderer";
import type { RenderParams } from "@/types";
import { clamp } from "@/utils/math";

export function useRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const rendererRef = useRef<RendererType | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastScaleRef = useRef<number>(1);
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const lastTimelineTimeRef = useRef<number>(-1);
  const lastWeatherTypeRef = useRef<string>("clear");
  const lastRainIntensityRef = useRef<string>("moderate");
  const lastDensityRef = useRef<number>(1);
  const lastWindInfluenceRef = useRef<number>(1);
  const fpsAccumRef = useRef<{ frames: number; startTime: number; fps: number }>({
    frames: 0,
    startTime: 0,
    fps: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer(canvas);
    } catch (err) {
      console.error("Failed to create renderer:", err);
      const msg = document.getElementById("gl-error");
      if (msg) msg.textContent = err instanceof Error ? err.message : String(err);
      return;
    }
    rendererRef.current = renderer;
    renderer.onStats = (stats) => {
      const currentFps = useStatsStore.getState().fps;
      useStatsStore.getState().setStats({ ...stats, fps: currentFps });
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width * dpr));
      const h = Math.max(1, Math.round(rect.height * dpr));
      lastSizeRef.current = { w, h };
      const scale = useParamsStore.getState().params.resolutionScale;
      lastScaleRef.current = scale;
      renderer.resize(w, h, scale);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const applyWeatherOffset = (params: RenderParams, time: number): RenderParams => {
      const timelineState = useTimelineStore.getState();

      if (timelineState.weatherLocked) {
        return params;
      }

      const offset = timelineState.getWeatherCloudOffset(time);

      return {
        ...params,
        coverage: clamp(params.coverage + offset.coverageOffset, 0, 1),
        windSpeed: clamp(params.windSpeed * offset.windMultiplier, 0, 3),
      };
    };

    const updateWeatherPass = (params: RenderParams, time: number): void => {
      const timelineState = useTimelineStore.getState();
      const weatherType = params.weatherType;
      const rainIntensity = params.rainIntensity;
      const density = params.particleDensityMultiplier;
      const windInfluence = params.windParticleInfluence;

      const duration = timelineState.weatherTransitionDuration;
      renderer.setWeatherTransitionDuration(duration);

      renderer.setBaseWeatherParams(
        useParamsStore.getState().params.coverage,
        useParamsStore.getState().params.windSpeed,
      );

      const typeChanged = weatherType !== lastWeatherTypeRef.current;
      const intensityChanged = rainIntensity !== lastRainIntensityRef.current;
      const densityChanged = Math.abs(density - lastDensityRef.current) > 0.001;
      const windChanged = Math.abs(windInfluence - lastWindInfluenceRef.current) > 0.001;

      if (typeChanged || intensityChanged || densityChanged || windChanged) {
        renderer.setWeatherState(
          weatherType,
          rainIntensity,
          density,
          windInfluence,
          time * 0.001,
        );
        lastWeatherTypeRef.current = weatherType;
        lastRainIntensityRef.current = rainIntensity;
        lastDensityRef.current = density;
        lastWindInfluenceRef.current = windInfluence;
      }
    };

    const loop = (now: number) => {
      const last = lastTimeRef.current || now;
      const dt = now - last;
      lastTimeRef.current = now;

      const acc = fpsAccumRef.current;
      acc.frames++;
      if (acc.startTime === 0) acc.startTime = now;
      const elapsed = now - acc.startTime;
      if (elapsed >= 500) {
        const fps = Math.round((acc.frames * 1000) / elapsed);
        acc.frames = 0;
        acc.startTime = now;
        useStatsStore.getState().setStats({ fps });
      }

      const paramState = useParamsStore.getState();
      const cameraState = useCameraStore.getState();
      const timelineState = useTimelineStore.getState();
      if (paramState.isTransitioning) paramState.tickTransition(dt);
      if (cameraState.isTransitioning) cameraState.tickTransition(dt);

      const tickResult = timelineState.tick(dt, paramState.params);

      const currentTimelineState = useTimelineStore.getState();
      const currentTimelineTime = currentTimelineState.currentTime;
      const prevTimelineTime = lastTimelineTimeRef.current;
      const timeChanged = Math.abs(currentTimelineTime - prevTimelineTime) > 0.001 || prevTimelineTime < 0;
      const hasKeyframes = currentTimelineState.keyframes.length > 0;
      const shouldInterpolate = currentTimelineState.useWeatherPreset || hasKeyframes || currentTimelineState.useWeatherKeyframes;

      let renderParams = paramState.params;

      if (tickResult !== null && shouldInterpolate) {
        paramState.setParams(tickResult);
        renderParams = tickResult;
        lastTimelineTimeRef.current = currentTimelineTime;
      } else if (timeChanged && shouldInterpolate) {
        const interpolated = currentTimelineState.getInterpolatedParams(currentTimelineTime, paramState.params);
        paramState.setParams(interpolated);
        renderParams = interpolated;
        lastTimelineTimeRef.current = currentTimelineTime;
      }

      renderParams = applyWeatherOffset(renderParams, currentTimelineTime);

      updateWeatherPass(renderParams, now);

      if (paramState.params.resolutionScale !== lastScaleRef.current) {
        const { w, h } = lastSizeRef.current;
        if (w > 0 && h > 0) {
          lastScaleRef.current = paramState.params.resolutionScale;
          renderer.resize(w, h, paramState.params.resolutionScale);
        }
      }

      renderer.renderFrame(renderParams, cameraState.camera, now);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [canvasRef]);

  return rendererRef;
}
