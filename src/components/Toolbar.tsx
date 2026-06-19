import { useRef, useState } from "react";
import {
  Camera, Download, Film, Upload, PanelLeftClose, PanelLeftOpen, BarChart3, Loader2,
} from "lucide-react";
import { useUIStore } from "@/store/ui";
import { usePresetStore } from "@/store/preset";
import { downloadBlob, exportConfigJson, importConfigJson, recordGif } from "@/utils/export";
import { cn } from "@/lib/utils";

interface ToolbarProps {
  canvas: HTMLCanvasElement | null;
  accent: string;
  onScreenshot: (w: number, h: number) => Promise<Blob>;
}

export function Toolbar({ canvas, accent, onScreenshot }: ToolbarProps) {
  const panelOpen = useUIStore((s) => s.panelOpen);
  const togglePanel = useUIStore((s) => s.togglePanel);
  const showStats = useUIStore((s) => s.showStats);
  const setShowStats = useUIStore((s) => s.setShowStats);
  const setRecording = usePresetStore((s) => s.setRecording);
  const recording = usePresetStore((s) => s.recording);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<null | "shot" | "gif" | "json">(null);
  const [progress, setProgress] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  };

  const handleScreenshot = async () => {
    if (busy || !canvas) return;
    setBusy("shot");
    try {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      const w = Math.min(3840, Math.round(rect.width * dpr * 1.5));
      const h = Math.round((w / rect.width) * rect.height);
      const blob = await onScreenshot(w, h);
      downloadBlob(blob, `cloud-render-${Date.now()}.png`);
      flash("已导出 4K 截图");
    } catch (e) {
      flash("截图失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const handleGif = async () => {
    if (busy || !canvas) return;
    setBusy("gif");
    setRecording(true);
    setProgress(0);
    try {
      const blob = await recordGif(canvas, {
        duration: 5000,
        fps: 15,
        maxWidth: 480,
        rotateCamera: true,
        onProgress: (p) => setProgress(p),
      });
      downloadBlob(blob, `cloud-animation-${Date.now()}.gif`);
      flash("已录制 5 秒 GIF");
    } catch (e) {
      flash("录制失败: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
      setRecording(false);
      setProgress(0);
    }
  };

  const handleExportJson = () => {
    exportConfigJson();
    flash("已导出配置 JSON");
  };

  const handleImport = async (file: File) => {
    try {
      await importConfigJson(file);
      flash("已加载配置");
    } catch (e) {
      flash("导入失败: " + (e instanceof Error ? e.message : String(e)));
    }
  };

  return (
    <div className="relative flex items-center gap-1.5">
      <ToolbarButton onClick={togglePanel} active={panelOpen} title={panelOpen ? "收起面板" : "展开面板"}>
        {panelOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-white/10" />

      <ToolbarButton onClick={handleScreenshot} disabled={busy !== null} title="4K 超采样截图">
        {busy === "shot" ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
      </ToolbarButton>

      <ToolbarButton onClick={handleGif} disabled={busy !== null} title="录制 5 秒 GIF 动画" active={recording}>
        {busy === "gif" ? <Loader2 size={16} className="animate-spin" /> : <Film size={16} />}
        {recording && (
          <span className="absolute -bottom-1 left-0 h-0.5 bg-amber-glow transition-all" style={{ width: `${progress * 100}%` }} />
        )}
      </ToolbarButton>

      <ToolbarButton onClick={handleExportJson} disabled={busy !== null} title="导出参数为 JSON">
        <Download size={16} />
      </ToolbarButton>

      <ToolbarButton onClick={() => fileRef.current?.click()} disabled={busy !== null} title="导入 JSON 配置">
        <Upload size={16} />
      </ToolbarButton>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImport(f);
          e.target.value = "";
        }}
      />

      <div className="mx-1 h-5 w-px bg-white/10" />

      <ToolbarButton onClick={() => setShowStats(!showStats)} active={showStats} title="性能统计">
        <BarChart3 size={16} />
      </ToolbarButton>

      {toast && (
        <div className="absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg glass px-3 py-1.5 text-[12px] text-cloud shadow-panel animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

function ToolbarButton({
  children, onClick, active, disabled, title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "icon-btn relative overflow-visible",
        active && "icon-btn-active",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}
