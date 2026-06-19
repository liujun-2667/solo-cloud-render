import { useParamsStore } from "@/store/renderParams";
import { useCameraStore } from "@/store/camera";
import { usePresetStore } from "@/store/preset";
import type { RenderParams, CameraState } from "@/types";
import { encodeGif, quantizeToIndexed, type GifFrame } from "./gif";

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export interface SceneConfig {
  version: 1;
  params: RenderParams;
  camera: CameraState;
  presetId: string | null;
  exportedAt: string;
}

export function buildConfig(): SceneConfig {
  const params = useParamsStore.getState().params;
  const camera = useCameraStore.getState().camera;
  const presetId = usePresetStore.getState().activePresetId;
  return {
    version: 1,
    params,
    camera,
    presetId,
    exportedAt: new Date().toISOString(),
  };
}

export function exportConfigJson(): void {
  const config = buildConfig();
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  downloadBlob(blob, `cloud-scene-${Date.now()}.json`);
}

export async function importConfigJson(file: File): Promise<void> {
  const text = await file.text();
  const data = JSON.parse(text) as SceneConfig;
  if (data.version !== 1) throw new Error("Unsupported config version.");
  useParamsStore.getState().loadParams(data.params);
  useCameraStore.getState().loadCamera(data.camera);
}

export interface GifRecordOptions {
  duration?: number;
  fps?: number;
  maxWidth?: number;
  rotateCamera?: boolean;
  onProgress?: (p: number) => void;
}

export async function recordGif(
  canvas: HTMLCanvasElement,
  opts: GifRecordOptions = {},
): Promise<Blob> {
  const duration = opts.duration ?? 5000;
  const fps = opts.fps ?? 15;
  const maxWidth = opts.maxWidth ?? 480;
  const rotate = opts.rotateCamera ?? true;
  const frameCount = Math.round((duration / 1000) * fps);
  const delayCs = Math.round(100 / fps);

  const scale = Math.min(1, maxWidth / canvas.width);
  const w = Math.max(2, Math.round(canvas.width * scale));
  const h = Math.max(2, Math.round(canvas.height * scale));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true })!;

  const startAz = useCameraStore.getState().camera.azimuth;
  const frames: GifFrame[] = [];

  for (let i = 0; i < frameCount; i++) {
    if (rotate) {
      const t = i / frameCount;
      useCameraStore.getState().setAzimuth(startAz + t * 360);
    }
    // Wait for two animation frames so the render loop paints the new camera.
    await nextFrame();
    await nextFrame();
    ctx.drawImage(canvas, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h).data;
    const indexed = quantizeToIndexed(img, w, h);
    frames.push({ indexed, width: w, height: h, delayCs });
    opts.onProgress?.((i + 1) / frameCount);
  }

  return encodeGif(frames, 0);
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}
