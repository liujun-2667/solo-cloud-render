import { useEffect, useMemo, useRef } from "react";
import { Cloud } from "lucide-react";
import { useRenderer } from "@/hooks/useRenderer";
import { useOrbitControl } from "@/hooks/useOrbitControl";
import { useUIStore } from "@/store/ui";
import { usePresetStore } from "@/store/preset";
import { useStatsStore } from "@/store/stats";
import { getPresetById, DEFAULT_PRESET_ID } from "@/presets/presets";
import { ControlPanel } from "@/components/ControlPanel";
import { PresetBar } from "@/components/PresetBar";
import { Toolbar } from "@/components/Toolbar";
import { StatsOverlay } from "@/components/StatsOverlay";
import { cn } from "@/lib/utils";

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRenderer(canvasRef);
  useOrbitControl(canvasRef);

  const panelOpen = useUIStore((s) => s.panelOpen);
  const showStats = useUIStore((s) => s.showStats);
  const activeId = usePresetStore((s) => s.activePresetId);
  const setActivePreset = usePresetStore((s) => s.setActivePreset);
  const fps = useStatsStore((s) => s.fps);

  const accent = useMemo(() => getPresetById(activeId)?.accent ?? "#4fc3f7", [activeId]);

  // Apply the default preset once on mount (without animation) so the initial
  // render matches the selected preset rather than raw defaults.
  useEffect(() => {
    setActivePreset(DEFAULT_PRESET_ID, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScreenshot = async (w: number, h: number) => {
    const renderer = rendererRef.current;
    if (!renderer) throw new Error("Renderer not ready");
    const { useParamsStore } = await import("@/store/renderParams");
    const { useCameraStore } = await import("@/store/camera");
    const params = useParamsStore.getState().params;
    const camera = useCameraStore.getState().camera;
    return renderer.screenshot(params, camera, w, h);
  };

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-ink-950 text-cloud">
      {/* Canvas stage */}
      <div className="relative h-full flex-1">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          style={{ display: "block" }}
        />

        {/* Top overlay: brand + toolbar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-4">
          <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl glass px-3.5 py-2 shadow-panel">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
              style={{ background: `${accent}22`, color: accent, boxShadow: `0 0 16px -4px ${accent}80` }}
            >
              <Cloud size={16} />
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold tracking-wide">云霁</div>
              <div className="text-[10px] text-cloud-dim/70 font-mono">体积云 · 大气散射</div>
            </div>
          </div>

          <div className="pointer-events-auto rounded-xl glass px-2 py-1.5 shadow-panel">
            <Toolbar canvas={canvasRef.current} accent={accent} onScreenshot={onScreenshot} />
          </div>
        </div>

        {/* Preset bar */}
        <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-20 p-4">
          <div className="mx-auto max-w-3xl rounded-xl glass px-2 py-1.5 shadow-panel">
            <PresetBar accent={accent} />
          </div>
        </div>

        {/* Hint */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0 opacity-0" />

        {/* Stats */}
        {showStats && <StatsOverlay />}

        {/* Camera hint */}
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full glass-soft px-3 py-1 text-[10px] text-cloud-dim/70 font-mono animate-fade-in">
          拖拽旋转视角 · 滚轮缩放 FOV
        </div>

        {/* GL error placeholder */}
        <div id="gl-error" className="hidden" />

        {/* Loading veil until first frame */}
        {fps === 0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink-950">
            <div className="flex flex-col items-center gap-3">
              <div
                className="h-10 w-10 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: accent, borderRightColor: `${accent}55` }}
              />
              <div className="text-[12px] text-cloud-dim font-mono">初始化渲染管线…</div>
            </div>
          </div>
        )}
      </div>

      {/* Control panel */}
      <aside
        className={cn(
          "glass-panel relative z-30 h-full shrink-0 overflow-hidden transition-all duration-300 ease-out",
          panelOpen ? "w-[320px]" : "w-0",
        )}
      >
        <div className="h-full w-[320px]">
          <ControlPanel accent={accent} />
        </div>
      </aside>
    </div>
  );
}
