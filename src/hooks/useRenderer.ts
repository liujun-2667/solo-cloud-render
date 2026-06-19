import { useEffect, useRef } from "react";
import { Renderer } from "@/render/Renderer";
import { useParamsStore } from "@/store/renderParams";
import { useCameraStore } from "@/store/camera";
import { useStatsStore } from "@/store/stats";
import { useTimelineStore } from "@/store/timeline";
import type { Renderer as RendererType } from "@/render/Renderer";

export function useRenderer(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const rendererRef = useRef<RendererType | null>(null);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastScaleRef = useRef<number>(1);
  const lastSizeRef = useRef<{ w: number; h: number }>({ w: 0, h: 0 });
  const lastTimelineTimeRef = useRef<number>(-1);
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

      timelineState.tick(dt, paramState.params);

      const prevTimelineTime = lastTimelineTimeRef.current;
      const timeChanged = Math.abs(timelineState.currentTime - prevTimelineTime) > 0.001 || prevTimelineTime < 0;
      const hasKeyframes = timelineState.keyframes.length > 0;
      const shouldInterpolate = timelineState.useWeatherPreset || hasKeyframes;

      if (timeChanged && shouldInterpolate) {
        const baseForInterp = hasKeyframes ? paramState.params : paramState.params;
        const interpolated = timelineState.getInterpolatedParams(timelineState.currentTime, baseForInterp);
        paramState.setParams(interpolated);
        lastTimelineTimeRef.current = timelineState.currentTime;
      }

      // Re-resize if the quality scale changed since last frame.
      if (paramState.params.resolutionScale !== lastScaleRef.current) {
        const { w, h } = lastSizeRef.current;
        if (w > 0 && h > 0) {
          lastScaleRef.current = paramState.params.resolutionScale;
          renderer.resize(w, h, paramState.params.resolutionScale);
        }
      }

      renderer.renderFrame(paramState.params, cameraState.camera, now);
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
